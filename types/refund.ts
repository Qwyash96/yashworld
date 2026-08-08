import type { PaymentMethod } from "./order"

/** FULL: eligible amount auto-calculated and charged as-is. MANUAL: a
 * Finance Admin enters any amount up to the eligible amount, with a
 * mandatory reason — see app/admin/refunds/[id]/page.tsx. */
export type RefundMode = "full" | "manual"

/**
 * Lifecycle of one refund request/record.
 * Pending -> Approved happens instantly on a Finance Admin's confirm click
 * (single-actor flow — the confirm click IS the approval). From there:
 *  - Prepaid: Approved -> Processing -> Refunded/Failed, synchronously,
 *    driven by the real payment gateway's response (lib/refund-service.ts).
 *  - COD: stays at Approved — there is no live gateway to call, so it sits
 *    as a finance payout/refund record until a Finance Admin manually marks
 *    it Refunded (money actually sent outside the system) or Failed/Rejected.
 */
export type RefundRequestStatus = "Pending" | "Approved" | "Processing" | "Refunded" | "Failed" | "Rejected"

/** Every amount a Finance Admin needs to see before confirming a refund —
 * computed fresh from the order (and any prior refund history) at request
 * time, never stored stale. See lib/refund-service.ts's computeRefundBreakdown. */
export interface RefundBreakdown {
  /** order.totals.total — what the buyer was actually charged. */
  orderAmount: number
  /** order.totals.subtotal (or, when scoped to one seller, that seller's item total). */
  productAmount: number
  /** order.totals.shipping — only ever included in an order-level (not seller-scoped) refund. */
  deliveryCharge: number
  /** order.totals.discount — only ever included in an order-level (not seller-scoped) refund. */
  discount: number
  /** Sum of every "Refunded" (completed) record's amount for this order/seller scope so far. */
  previouslyRefunded: number
  /** orderAmount (or seller item total) - previouslyRefunded, floored at 0 — before any Finance
   * adjustment. Shown to the Finance Admin as "Eligible Refund". */
  eligibleAmount: number
  /** Sum of every Approved "refund_adjustment" FinanceAdjustment (types/finance.ts) for this
   * order — a Finance-entered reduction (damage, restocking fee, ...) on top of the eligible
   * amount. Always 0 for a seller-scoped breakdown; a refund_adjustment is order-level only. */
  adjustmentAmount: number
  /** eligibleAmount - adjustmentAmount, floored at 0 — the REAL maximum a new refund may claim.
   * Shown to the Finance Admin as "Final Refund"; both Full and Manual refunds are capped by
   * this, not by eligibleAmount, once any adjustment exists. */
  finalRefundAmount: number
}

/** Firestore `orders/{orderId}/refunds/{refundId}` — one document per refund
 * attempt, kept even for a Rejected/Failed one so the full audit trail
 * survives (never overwritten/deleted). */
export interface RefundRequest {
  id: string
  /** Sequential, human-readable id (REFnnnn) minted once at creation — see
   * lib/sequential-id.ts. Reused verbatim as the documentNumber of the
   * Refund Receipt generated once this refund actually reaches "Refunded"
   * (lib/finance-documents.ts) — one refund, one number, everywhere. */
  refundNumber: string
  orderId: string
  /** Scopes the refund to one seller's portion of a multi-seller order — undefined refunds the whole order. */
  sellerId?: string
  mode: RefundMode
  /** The final amount this record claims/moves — always <= breakdown.eligibleAmount at creation time. */
  amount: number
  /** Required for mode "manual"; optional (auto-filled) for mode "full". */
  reason?: string
  breakdown: RefundBreakdown
  status: RefundRequestStatus
  paymentMethod: PaymentMethod
  /** The Finance Admin / Super Admin who confirmed this refund — buyers and sellers can never set this. */
  approvedBy: { uid: string; email: string }
  createdAt: string
  updatedAt: string
  /** Set once the record reaches a terminal state (Refunded/Failed/Rejected). */
  processedAt?: string
  /** Set only when status is "Failed" — the real reason the gateway or a manual decision gave. */
  failureReason?: string
  /** Set only for a prepaid refund that actually reached the gateway. */
  gatewayId?: string
  gatewayRefundId?: string
}

export type RefundRequestInput = {
  mode: RefundMode
  /** Required for "manual"; ignored (computed) for "full". */
  amount?: number
  /** Required for "manual". */
  reason?: string
  sellerId?: string
}
