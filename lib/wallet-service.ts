import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Recomputes a seller's wallet from their own orders + withdrawal requests
 * (a bounded fetch-and-reduce, not a persisted running ledger — payoutStatus
 * transitions aren't event-driven the way stock decrements are, so
 * recomputing on read keeps this always-correct with no cron job). Upserts
 * the result into sellerWallets/{sellerId} as a read-through cache.
 *
 * - `pendingBalance`: payoutAmount for sellerOrders still On Hold (delivered,
 *   inside the return window).
 * - `balance`: payoutAmount for sellerOrders already Released, minus
 *   whatever's already been paid out or is reserved by a requested/approved
 *   withdrawal — i.e. what's actually available to request right now.
 * - `lifetimeEarnings`: everything ever delivered (Hold + Released), whether
 *   or not it's been withdrawn yet.
 * - `lifetimeWithdrawn`: withdrawal requests actually marked "paid".
 */
export async function recomputeSellerWallet(sellerId: string): Promise<SellerWallet> {
  const db = getAdminDb()

  const [ordersSnap, withdrawalsSnap] = await Promise.all([
    db.collection("orders").where("sellerIds", "array-contains", sellerId).get(),
    db.collection("withdrawalRequests").where("sellerId", "==", sellerId).get(),
  ])

  let pendingBalance = 0
  let releasedTotal = 0
  for (const doc of ordersSnap.docs) {
    const order = doc.data() as Order
    const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
    if (!sellerOrder || sellerOrder.status === "Cancelled") continue
    if (sellerOrder.payoutStatus === "Hold") pendingBalance += sellerOrder.payoutAmount
    else if (sellerOrder.payoutStatus === "Released") releasedTotal += sellerOrder.payoutAmount
  }

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
    pendingBalance: round2(pendingBalance),
    lifetimeEarnings: round2(releasedTotal + pendingBalance),
    lifetimeWithdrawn: round2(withdrawnTotal),
    updatedAt: new Date().toISOString(),
  }

  await db.collection("sellerWallets").doc(sellerId).set(wallet)
  return wallet
}
