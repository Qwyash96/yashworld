import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { FinanceDocument, FinanceDocumentType } from "@/types/finance-document"
import type { FinanceAdjustment } from "@/types/finance"

const DOCUMENT_PREFIX: Record<FinanceDocumentType, string> = {
  invoice: "INV",
  payment_receipt: "PAY",
  refund_receipt: "REF",
  credit_note: "CRN",
  debit_statement: "DBS",
  credit_statement: "CRS",
}

/** Transactionally-incremented per-type, per-month counter — gives every
 * generated document a real, unique, sequential number (e.g.
 * "DBS-202608-000001") rather than a random id, matching what a Finance
 * team expects from a numbered financial document. */
async function nextDocumentNumber(type: FinanceDocumentType): Promise<string> {
  const db = getAdminDb()
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "")
  const counterRef = db.collection("financeDocumentCounters").doc(`${type}-${yearMonth}`)

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = ((snap.data()?.seq as number | undefined) ?? 0) + 1
    tx.set(counterRef, { seq: next }, { merge: true })
    return next
  })

  return `${DOCUMENT_PREFIX[type]}-${yearMonth}-${String(seq).padStart(6, "0")}`
}

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
}

export async function createFinanceDocumentRecord(input: CreateFinanceDocumentInput, actor: ActorInfo): Promise<FinanceDocument> {
  const documentNumber = await nextDocumentNumber(input.type)
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
 * a debit against the buyer's refund -> Debit Statement too. */
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
    },
    actor,
  )
}

/** Generated once a refund actually reaches "Refunded" (never earlier —
 * see lib/refund-service.ts, which only calls this after the gateway, or a
 * Finance Admin's manual COD decision, confirms the money actually moved). */
export async function createFinanceDocumentForRefund(
  refund: { id: string; orderId: string; amount: number },
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

export async function getFinanceDocument(id: string): Promise<FinanceDocument | null> {
  const snap = await getAdminDb().collection("financeDocuments").doc(id).get()
  return snap.exists ? ({ id: snap.id, ...snap.data() } as FinanceDocument) : null
}
