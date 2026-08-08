import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { RETURN_WINDOW_DAYS } from "@/types/order-lifecycle"
import { round2 } from "@/lib/utils"
import { listApprovedAdjustmentsForParty } from "@/lib/finance-ledger-shared"
import { signedAmount } from "@/types/finance"
import type { Order } from "@/types/order"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"

/**
 * Recomputes a seller's wallet from their own orders + withdrawal requests
 * (a bounded fetch-and-reduce, not a persisted running ledger — payoutStatus
 * transitions aren't event-driven the way stock decrements are, so
 * recomputing on read keeps this always-correct with no cron job). Upserts
 * the result into sellerWallets/{sellerId} as a read-through cache.
 *
 * - `onHoldBalance`: payoutAmount for sellerOrders still On Hold AND inside
 *   the return window — not eligible for release yet.
 * - `pendingSettlement`: payoutAmount for sellerOrders still On Hold but the
 *   return window has already elapsed — eligible for release, just waiting
 *   on the admin release-holds batch (app/api/admin/wallets/release-holds)
 *   to actually run. Distinct from onHoldBalance: this is waiting on an
 *   admin action, not on time.
 * - `balance`: payoutAmount for sellerOrders already Released, minus
 *   whatever's already been paid out or is reserved by a requested/approved
 *   withdrawal — i.e. what's actually available to request right now.
 * - `lifetimeEarnings`: everything ever delivered (Hold + Released), whether
 *   or not it's been withdrawn yet.
 * - `lifetimeWithdrawn`: withdrawal requests actually marked "paid".
 *
 * Also folds in every Approved Finance charge/credit (types/finance.ts) for
 * this seller — an order-scoped one nets into whichever bucket that order's
 * own payoutAmount already landed in above (Hold/pendingSettlement/
 * Released), so a damage charge on a still-held order reduces onHoldBalance
 * rather than a bucket that hasn't been earned yet; a seller-wide one (no
 * orderId) nets straight into the available `balance`, matching Finance's
 * intent that an un-scoped credit/charge take effect immediately.
 */
export async function recomputeSellerWallet(sellerId: string): Promise<SellerWallet> {
  const db = getAdminDb()

  const [ordersSnap, withdrawalsSnap, adjustments] = await Promise.all([
    db.collection("orders").where("sellerIds", "array-contains", sellerId).get(),
    db.collection("withdrawalRequests").where("sellerId", "==", sellerId).get(),
    listApprovedAdjustmentsForParty("seller", sellerId),
  ])

  const now = Date.now()
  let onHoldBalance = 0
  let pendingSettlement = 0
  let releasedTotal = 0
  const adjustmentByOrderId = new Map<string, number>()
  let unscopedAdjustmentTotal = 0
  for (const adj of adjustments) {
    const amount = signedAmount(adj.type === "refund_adjustment" ? "charge" : adj.type, adj.amount)
    if (adj.orderId) {
      adjustmentByOrderId.set(adj.orderId, (adjustmentByOrderId.get(adj.orderId) ?? 0) + amount)
    } else {
      unscopedAdjustmentTotal += amount
    }
  }

  for (const doc of ordersSnap.docs) {
    const order = doc.data() as Order
    const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
    if (!sellerOrder || sellerOrder.status === "Cancelled" || sellerOrder.status === "Returned") continue
    const payoutAmount = sellerOrder.payoutAmount + (adjustmentByOrderId.get(order.id) ?? 0)
    if (sellerOrder.payoutStatus === "Hold") {
      const daysSinceDelivery = sellerOrder.deliveredAt ? (now - new Date(sellerOrder.deliveredAt).getTime()) / 86_400_000 : 0
      if (daysSinceDelivery >= RETURN_WINDOW_DAYS) pendingSettlement += payoutAmount
      else onHoldBalance += payoutAmount
    } else if (sellerOrder.payoutStatus === "Released") {
      releasedTotal += payoutAmount
    }
  }
  releasedTotal += unscopedAdjustmentTotal

  let reservedTotal = 0
  let withdrawnTotal = 0
  for (const doc of withdrawalsSnap.docs) {
    const request = doc.data() as WithdrawalRequest
    if (request.status === "requested" || request.status === "approved") reservedTotal += request.amount
    else if (request.status === "paid") withdrawnTotal += request.amount
  }

  const wallet: SellerWallet = {
    sellerId,
    balance: round2(Math.max(0, releasedTotal - reservedTotal - withdrawnTotal)),
    onHoldBalance: round2(onHoldBalance),
    pendingSettlement: round2(pendingSettlement),
    lifetimeEarnings: round2(releasedTotal + onHoldBalance + pendingSettlement),
    lifetimeWithdrawn: round2(withdrawnTotal),
    updatedAt: new Date().toISOString(),
  }

  await db.collection("sellerWallets").doc(sellerId).set(wallet)
  return wallet
}
