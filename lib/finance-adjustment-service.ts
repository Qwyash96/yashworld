import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { round2 } from "@/lib/utils"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { listRefundHistory, listApprovedAdjustments } from "@/lib/finance-ledger-shared"
import { mintSequentialId } from "@/lib/sequential-id"
import { signedAmount } from "@/types/finance"
import type { AdjustmentType, AdjustmentParty, FinanceAdjustment, FinanceAdjustmentInput } from "@/types/finance"
import type { Order } from "@/types/order"

/**
 * The Finance Adjustment system — Charge/Credit apply to a seller's
 * settlement (per-order or seller-wide), Refund Adjustment applies to a
 * buyer's order-level eligible refund (lib/refund-service.ts reads it back
 * out). Kept as two distinct party/type pairings rather than a generic
 * "adjust anything" system: this codebase has no standing buyer-wallet to
 * apply a charge/credit against outside of the refund path, and a
 * refund_adjustment only ever means something in the context of one
 * order's refund — see validateInput below.
 */
function validateInput(input: FinanceAdjustmentInput): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be a positive value — enter it as a magnitude (e.g. Charge ₹100), never as a negative number.")
  }
  if (!input.reason?.trim()) {
    throw new Error("A reason is required for every financial adjustment.")
  }
  if (input.type === "refund_adjustment") {
    if (input.partyType !== "buyer") throw new Error("A refund adjustment must target the buyer.")
    if (!input.orderId) throw new Error("A refund adjustment must be tied to an order.")
  } else {
    if (input.partyType !== "seller") throw new Error("A charge or credit must target a seller.")
  }
}

interface BalanceSnapshot {
  previousBalance: number
  newBalance: number
}

/** The affected balance immediately before/after this adjustment — a
 * point-in-time audit snapshot, not the system of record (the live figure
 * always comes from lib/wallet-service.ts / lib/refund-service.ts, which
 * both independently re-derive it from the full order + adjustment
 * history on every read). */
async function computeBalanceSnapshot(order: Order | null, input: FinanceAdjustmentInput): Promise<BalanceSnapshot> {
  const delta = signedAmount(input.type, input.amount)

  if (input.type === "refund_adjustment") {
    if (!order) throw new Error("Order not found.")
    const [refunds, priorAdjustments] = await Promise.all([
      listRefundHistory(order.id),
      listApprovedAdjustments({ orderId: order.id, partyType: "buyer", partyId: order.buyerId, type: "refund_adjustment" }),
    ])
    const previouslyRefunded = refunds.filter((r) => r.status === "Refunded").reduce((sum, r) => sum + r.amount, 0)
    const priorAdjustmentTotal = priorAdjustments.reduce((sum, a) => sum + a.amount, 0)
    const previousBalance = round2(Math.max(0, order.totals.total - previouslyRefunded - priorAdjustmentTotal))
    return { previousBalance, newBalance: round2(Math.max(0, previousBalance + delta)) }
  }

  if (input.orderId) {
    if (!order) throw new Error("Order not found.")
    const sellerOrder = order.sellerOrders.find((so) => so.sellerId === input.partyId)
    if (!sellerOrder) throw new Error("That seller has no items on this order.")
    const priorAdjustments = await listApprovedAdjustments({ orderId: order.id, partyType: "seller", partyId: input.partyId })
    const priorTotal = priorAdjustments.reduce((sum, a) => sum + signedAmount(a.type, a.amount), 0)
    const previousBalance = round2(sellerOrder.payoutAmount + priorTotal)
    return { previousBalance, newBalance: round2(previousBalance + delta) }
  }

  // Seller-wide (not order-scoped) — snapshot the actual current wallet
  // balance, the same figure app/seller/orders's Wallet section shows.
  const wallet = await recomputeSellerWallet(input.partyId)
  return { previousBalance: wallet.balance, newBalance: round2(Math.max(0, wallet.balance + delta)) }
}

interface ActorInfo {
  uid: string
  email: string
}

/** Creates a new adjustment at "Pending" — never applies any balance effect
 * or generates a document itself; see decideAdjustment for that (approval
 * is a distinct, explicit action, even when performed by the same Finance
 * Admin in one sitting). */
export async function createAdjustment(input: FinanceAdjustmentInput, actor: ActorInfo): Promise<FinanceAdjustment> {
  validateInput(input)

  const db = getAdminDb()
  let order: Order | null = null
  if (input.orderId) {
    const snap = await db.collection("orders").doc(input.orderId).get()
    if (!snap.exists) throw new Error("Order not found.")
    order = { id: snap.id, ...snap.data() } as Order
  }

  if (input.reversesAdjustmentId) {
    const original = await db.collection("financeAdjustments").doc(input.reversesAdjustmentId).get()
    if (!original.exists) throw new Error("The adjustment being reversed was not found.")
    const originalData = original.data() as FinanceAdjustment
    if (originalData.status !== "Approved") throw new Error("Only an Approved adjustment can be reversed.")
  }

  const { previousBalance, newBalance } = await computeBalanceSnapshot(order, input)
  const adjustmentNumber = await mintSequentialId("adjustment")

  const now = new Date().toISOString()
  const ref = db.collection("financeAdjustments").doc()
  const adjustment: FinanceAdjustment = {
    id: ref.id,
    adjustmentNumber,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    partyType: input.partyType,
    partyId: input.partyId,
    type: input.type,
    amount: round2(input.amount),
    reason: input.reason.trim(),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    status: "Pending",
    createdBy: actor,
    createdAt: now,
    previousBalance,
    newBalance,
    ...(input.relatedPaymentId ? { relatedPaymentId: input.relatedPaymentId } : {}),
    ...(input.reversesAdjustmentId ? { reversesAdjustmentId: input.reversesAdjustmentId } : {}),
  }
  await ref.set(adjustment)
  return adjustment
}

export interface DecideAdjustmentResult {
  adjustment: FinanceAdjustment
  documentId?: string
}

/**
 * Approve (applies the effect — recomputeSellerWallet/computeRefundBreakdown
 * pick it up on their next read, and a FinanceDocument is generated) or
 * Reject (terminal, no effect). Never valid from anything but "Pending" —
 * there is no "edit a completed adjustment"; see types/finance.ts's own
 * doc comment on why a correction must be a new reversing adjustment.
 */
export async function decideAdjustment(
  adjustmentId: string,
  decision: "Approved" | "Rejected",
  actor: ActorInfo,
): Promise<DecideAdjustmentResult> {
  const db = getAdminDb()
  const ref = db.collection("financeAdjustments").doc(adjustmentId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error("Adjustment not found.")
  const adjustment = snap.data() as FinanceAdjustment

  if (adjustment.status !== "Pending") {
    throw new Error(`Cannot ${decision === "Approved" ? "approve" : "reject"} an adjustment already "${adjustment.status}".`)
  }

  const now = new Date().toISOString()
  const patch: Partial<FinanceAdjustment> = { status: decision, approvedBy: actor, approvedAt: now }
  await ref.update(patch)

  if (decision !== "Approved") {
    return { adjustment: { ...adjustment, ...patch } }
  }

  const { createFinanceDocumentForAdjustment } = await import("@/lib/finance-documents")
  const document = await createFinanceDocumentForAdjustment({ ...adjustment, ...patch }, actor)
  await ref.update({ relatedDocumentId: document.id })

  return { adjustment: { ...adjustment, ...patch, relatedDocumentId: document.id }, documentId: document.id }
}

export interface ListAdjustmentsFilter {
  orderId?: string
  partyType?: AdjustmentParty
  partyId?: string
  type?: AdjustmentType
  status?: FinanceAdjustment["status"]
}

export async function listAdjustments(filter: ListAdjustmentsFilter): Promise<FinanceAdjustment[]> {
  let query: FirebaseFirestore.Query = getAdminDb().collection("financeAdjustments")
  if (filter.orderId) query = query.where("orderId", "==", filter.orderId)
  if (filter.partyType) query = query.where("partyType", "==", filter.partyType)
  if (filter.partyId) query = query.where("partyId", "==", filter.partyId)
  if (filter.type) query = query.where("type", "==", filter.type)
  if (filter.status) query = query.where("status", "==", filter.status)

  const snap = await query.orderBy("createdAt", "desc").limit(200).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FinanceAdjustment)
}

export async function getAdjustment(adjustmentId: string): Promise<FinanceAdjustment | null> {
  const snap = await getAdminDb().collection("financeAdjustments").doc(adjustmentId).get()
  return snap.exists ? ({ id: snap.id, ...snap.data() } as FinanceAdjustment) : null
}
