import { NextResponse, type NextRequest } from "next/server"
import { requireAnyPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { round2 } from "@/lib/utils"
import type { Order } from "@/types/order"
import type { RefundRequest } from "@/types/refund"
import type { FinanceAdjustment } from "@/types/finance"

function inRange(iso: string, from: string | null, to: string | null): boolean {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

/**
 * Finance Dashboard KPIs — Total Sales, Total Refunds, Pending Refunds,
 * Completed Refunds, Seller Payables, Platform Earnings, Charges, Credits,
 * Adjustments. Reachable by "payments" or "order_management" (read-only
 * for Operations, matching the permission matrix). All computed
 * server-side from real order/refund/adjustment data — the frontend never
 * supplies or trusts a number here.
 *
 * Filters: from/to (order createdAt date range), sellerId, buyerId,
 * paymentMethod. Refund and adjustment records are date-filtered on their
 * own createdAt in-memory (a bounded collectionGroup/collection fetch,
 * same "fetch and reduce" approach lib/wallet-service.ts already uses,
 * rather than a composite Firestore index per filter combination).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission(request, ["payments", "order_management"])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const sellerId = searchParams.get("sellerId")
  const buyerId = searchParams.get("buyerId")
  const paymentMethod = searchParams.get("paymentMethod")

  const db = getAdminDb()

  let orderQuery: FirebaseFirestore.Query = db.collection("orders")
  if (sellerId) orderQuery = orderQuery.where("sellerIds", "array-contains", sellerId)
  if (buyerId) orderQuery = orderQuery.where("buyerId", "==", buyerId)
  const ordersSnap = await orderQuery.limit(1000).get()

  let totalSales = 0
  let platformEarnings = 0
  let sellerPayables = 0
  for (const doc of ordersSnap.docs) {
    const order = doc.data() as Order
    if (!inRange(order.createdAt, from, to)) continue
    if (paymentMethod && order.paymentMethod !== paymentMethod) continue

    if (order.paymentStatus === "Paid" || order.paymentStatus === "Refunded") {
      totalSales += order.totals.total
    }
    for (const so of order.sellerOrders) {
      if (sellerId && so.sellerId !== sellerId) continue
      // Matches lib/wallet-service.ts's own exclusion exactly — a returned
      // (fully refunded) seller-order was never actually owed, the same
      // reason a cancelled one isn't.
      if (so.status === "Cancelled" || so.status === "Returned") continue
      platformEarnings += so.commissionAmount
      if (so.payoutStatus === "Hold" || so.payoutStatus === "Released") {
        sellerPayables += so.payoutAmount
      }
    }
  }

  const refundsSnap = await db.collectionGroup("refunds").limit(2000).get()
  let totalRefunds = 0
  let pendingRefunds = 0
  let completedRefunds = 0
  for (const doc of refundsSnap.docs) {
    const refund = doc.data() as RefundRequest
    if (!inRange(refund.createdAt, from, to)) continue
    if (sellerId && refund.sellerId !== sellerId) continue
    if (refund.status === "Refunded") {
      totalRefunds += refund.amount
      completedRefunds += 1
    } else if (refund.status === "Pending" || refund.status === "Approved" || refund.status === "Processing") {
      pendingRefunds += 1
    }
  }

  let adjustmentQuery: FirebaseFirestore.Query = db.collection("financeAdjustments").where("status", "==", "Approved")
  if (sellerId) adjustmentQuery = adjustmentQuery.where("partyId", "==", sellerId).where("partyType", "==", "seller")
  const adjustmentsSnap = await adjustmentQuery.limit(2000).get()
  let charges = 0
  let credits = 0
  let adjustmentsCount = 0
  for (const doc of adjustmentsSnap.docs) {
    const adjustment = doc.data() as FinanceAdjustment
    if (!inRange(adjustment.createdAt, from, to)) continue
    adjustmentsCount += 1
    if (adjustment.type === "credit") credits += adjustment.amount
    else charges += adjustment.amount
  }

  return NextResponse.json({
    totalSales: round2(totalSales),
    totalRefunds: round2(totalRefunds),
    pendingRefunds,
    completedRefunds,
    sellerPayables: round2(sellerPayables),
    platformEarnings: round2(platformEarnings),
    charges: round2(charges),
    credits: round2(credits),
    adjustments: adjustmentsCount,
  })
}
