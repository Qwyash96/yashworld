/**
 * Firestore `sellerWallets/{sellerId}` — a read-through cache, recomputed
 * from that seller's own orders by lib/wallet-service.ts rather than a
 * persisted running ledger (see that file's doc comment for why).
 */
export interface SellerWallet {
  sellerId: string
  /** Released funds not yet withdrawn — available to request payout for. */
  balance: number
  /** Delivered, still inside the RETURN_WINDOW_DAYS window — not eligible for release yet. */
  onHoldBalance: number
  /** Delivered, return window has elapsed — eligible for release, awaiting the
   * admin release-holds batch (app/api/admin/wallets/release-holds) actually
   * running. Distinct from onHoldBalance: this money is just waiting on an
   * admin action, not waiting on time. */
  pendingSettlement: number
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
  /** Sequential, human-readable id (SETnnnn) minted once at request time —
   * see lib/sequential-id.ts. A withdrawal request IS the seller
   * settlement in this codebase (there's no separate settlement entity),
   * so this is what's shown to the seller/admin instead of the raw
   * Firestore id. */
  settlementNumber: string
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
