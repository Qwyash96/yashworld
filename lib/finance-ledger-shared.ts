import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { FinanceAdjustment, AdjustmentType, AdjustmentParty } from "@/types/finance"
import type { RefundRequest } from "@/types/refund"

/**
 * Low-level Firestore reads shared by lib/refund-service.ts and
 * lib/finance-adjustment-service.ts — factored out here (rather than one
 * importing from the other) specifically to avoid a circular import: a
 * refund's eligible amount needs to know about approved refund_adjustment
 * records, and a new refund_adjustment's previousBalance snapshot needs to
 * know about existing refund history, so each service depends on this
 * shared, dependency-free module instead of on each other.
 */

export async function listRefundHistory(orderId: string, sellerId?: string): Promise<RefundRequest[]> {
  const snap = await getAdminDb().collection("orders").doc(orderId).collection("refunds").orderBy("createdAt", "desc").get()
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RefundRequest)
  return sellerId === undefined ? all.filter((r) => !r.sellerId) : all.filter((r) => r.sellerId === sellerId)
}

export interface AdjustmentScopeFilter {
  orderId?: string
  partyType: AdjustmentParty
  partyId: string
  type?: AdjustmentType
}

/** Every Approved adjustment matching this exact scope — Pending/Rejected
 * records never affect a balance, so callers filter to "Approved" only. */
export async function listApprovedAdjustments(filter: AdjustmentScopeFilter): Promise<FinanceAdjustment[]> {
  let query = getAdminDb()
    .collection("financeAdjustments")
    .where("partyType", "==", filter.partyType)
    .where("partyId", "==", filter.partyId)
    .where("status", "==", "Approved")

  if (filter.orderId) query = query.where("orderId", "==", filter.orderId)
  if (filter.type) query = query.where("type", "==", filter.type)

  const snap = await query.get()
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FinanceAdjustment)
  // orderId is an equality filter above only when provided — when it's
  // omitted we want strictly un-scoped (no orderId) records, which
  // Firestore can't express as "field does not exist" alongside the other
  // equality filters without a composite index for every combination, so
  // it's applied here instead.
  return filter.orderId ? all : all.filter((a) => !a.orderId)
}

/** Every Approved adjustment for a party, regardless of orderId — used by
 * lib/wallet-service.ts, which needs to net adjustments into whichever
 * per-order bucket (Hold/pendingSettlement/Released) each one belongs to,
 * unlike listApprovedAdjustments' single-scope query above. */
export async function listApprovedAdjustmentsForParty(partyType: AdjustmentParty, partyId: string): Promise<FinanceAdjustment[]> {
  const snap = await getAdminDb()
    .collection("financeAdjustments")
    .where("partyType", "==", partyType)
    .where("partyId", "==", partyId)
    .where("status", "==", "Approved")
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FinanceAdjustment)
}
