import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { mintSequentialId } from "@/lib/sequential-id"
import type { FinanceDocument, FinanceDocumentType } from "@/types/finance-document"
import type { FinanceAdjustment } from "@/types/finance"

interface ActorInfo {
  uid: string
  email: string
}

export interface CreateFinanceDocumentInput {
  type: FinanceDocumentType
  orderId?: string
  partyType: "buyer" | "seller"
  partyId: string
  relatedAdjustmentId?: string
  relatedRefundId?: string
  amount: number
  /** Reuse an already-minted number (an adjustment's ADJnnnn or a refund's
   * REFnnnn — one entity, one number, everywhere it's shown) instead of
   * minting a fresh document number. When omitted, a new number is minted
   * fresh via lib/sequential-id.ts, scoped by `type` (invoice -> INV,
   * payment_receipt -> PAY — the only two document types that are their
   * own standalone entity rather than paperwork for an adjustment/refund
   * that already has its own number). */
  documentNumber?: string
}

const MINTED_KIND: Partial<Record<FinanceDocumentType, "invoice" | "payment">> = {
  invoice: "invoice",
  payment_receipt: "payment",
}

export async function createFinanceDocumentRecord(input: CreateFinanceDocumentInput, actor: ActorInfo): Promise<FinanceDocument> {
  let documentNumber = input.documentNumber
  if (!documentNumber) {
    const kind = MINTED_KIND[input.type]
    if (!kind) {
      throw new Error(`Document type "${input.type}" must reuse an existing adjustment/refund number, not mint a new one.`)
    }
    documentNumber = await mintSequentialId(kind)
  }

  const ref = getAdminDb().collection("financeDocuments").doc()
  const document: FinanceDocument = {
    id: ref.id,
    documentNumber,
    type: input.type,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    partyType: input.partyType,
    partyId: input.partyId,
    ...(input.relatedAdjustmentId ? { relatedAdjustmentId: input.relatedAdjustmentId } : {}),
    ...(input.relatedRefundId ? { relatedRefundId: input.relatedRefundId } : {}),
    amount: input.amount,
    generatedBy: actor,
    createdAt: new Date().toISOString(),
  }
  await ref.set(document)
  return document
}

/** Charge/seller -> Debit Statement, Credit/seller -> Credit Statement, a
 * refund_adjustment (always buyer-scoped, always order-level) also reads as
 * a debit against the buyer's refund -> Debit Statement too. Always reuses
 * the adjustment's own adjustmentNumber (ADJnnnn) as the document's number
 * — the statement IS the adjustment's paperwork, not a separate numbered
 * entity, so it never mints a number of its own. */
export async function createFinanceDocumentForAdjustment(adjustment: FinanceAdjustment, actor: ActorInfo): Promise<FinanceDocument> {
  const type: FinanceDocumentType = adjustment.type === "credit" ? "credit_statement" : "debit_statement"
  return createFinanceDocumentRecord(
    {
      type,
      orderId: adjustment.orderId,
      partyType: adjustment.partyType,
      partyId: adjustment.partyId,
      relatedAdjustmentId: adjustment.id,
      amount: adjustment.amount,
      documentNumber: adjustment.adjustmentNumber,
    },
    actor,
  )
}

/** Generated once a refund actually reaches "Refunded" (never earlier —
 * see lib/refund-service.ts, which only calls this after the gateway, or a
 * Finance Admin's manual COD decision, confirms the money actually moved).
 * Always reuses the refund's own refundNumber (REFnnnn) — one refund, one
 * number, whether it's referenced as a RefundRequest or as this receipt. */
export async function createFinanceDocumentForRefund(
  refund: { id: string; refundNumber: string; orderId: string; amount: number },
  buyerId: string,
  actor: ActorInfo,
): Promise<FinanceDocument> {
  return createFinanceDocumentRecord(
    {
      type: "refund_receipt",
      orderId: refund.orderId,
      partyType: "buyer",
      partyId: buyerId,
      relatedRefundId: refund.id,
      amount: refund.amount,
      documentNumber: refund.refundNumber,
    },
    actor,
  )
}

export interface ListFinanceDocumentsFilter {
  orderId?: string
  partyType?: "buyer" | "seller"
  partyId?: string
  type?: FinanceDocumentType
}

export async function listFinanceDocuments(filter: ListFinanceDocumentsFilter): Promise<FinanceDocument[]> {
  let query: FirebaseFirestore.Query = getAdminDb().collection("financeDocuments")
  if (filter.orderId) query = query.where("orderId", "==", filter.orderId)
  if (filter.partyType) query = query.where("partyType", "==", filter.partyType)
  if (filter.partyId) query = query.where("partyId", "==", filter.partyId)
  if (filter.type) query = query.where("type", "==", filter.type)

  const snap = await query.orderBy("createdAt", "desc").limit(200).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FinanceDocument)
}

/** Finds an already-generated Invoice/Payment Receipt for this exact
 * (orderId, type, partyId), if one exists — used by the generate route to
 * stay idempotent (re-clicking "Download Invoice" on the same order must
 * never mint a second INV number for what is, functionally, the same
 * document). Charges/credits/refunds don't need this: each real Finance
 * approval or completed refund is a genuinely new, distinct event, so
 * minting a fresh ADJ/REF number every time is correct there. */
export async function findExistingFinanceDocument(
  orderId: string,
  type: FinanceDocumentType,
  partyId: string,
): Promise<FinanceDocument | null> {
  const snap = await getAdminDb()
    .collection("financeDocuments")
    .where("orderId", "==", orderId)
    .where("type", "==", type)
    .where("partyId", "==", partyId)
    .limit(1)
    .get()
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as FinanceDocument)
}

export async function getFinanceDocument(id: string): Promise<FinanceDocument | null> {
  const snap = await getAdminDb().collection("financeDocuments").doc(id).get()
  return snap.exists ? ({ id: snap.id, ...snap.data() } as FinanceDocument) : null
}
