/**
 * Firestore `sellerWallets/{sellerId}` — a read-through cache, recomputed
 * from that seller's own orders by lib/wallet-service.ts rather than a
 * persisted running ledger (see that file's doc comment for why).
 */
export interface SellerWallet {
  sellerId: string
  /** Released funds not yet withdrawn — available to request payout for. */
  balance: number
  /** Funds still on Hold (delivered, inside the return window). */
  pendingBalance: number
  lifetimeEarnings: number
  lifetimeWithdrawn: number
  updatedAt: string
}

/**
 * A withdrawal request's own approval workflow — deliberately a separate
 * status type from SellerPayoutStatus (types/order-lifecycle.ts), which
 * describes a SellerOrder's money state, not a withdrawal request document.
 */
export type WithdrawalRequestStatus = "requested" | "approved" | "paid" | "rejected"

/** Firestore `withdrawalRequests/{id}`. */
export interface WithdrawalRequest {
  id: string
  sellerId: string
  amount: number
  status: WithdrawalRequestStatus
  requestedAt: string
  decidedAt?: string
  decidedBy?: string
  rejectionReason?: string
  paidAt?: string
}

export type WithdrawalRequestInput = Omit<WithdrawalRequest, "id" | "status" | "requestedAt">

/** A withdrawal request denormalized with the seller's shop name, for the
 * platform-wide /admin/payouts list (as opposed to the per-seller wallet tab). */
export interface PayoutRow extends WithdrawalRequest {
  sellerShopName: string
}
