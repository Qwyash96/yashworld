/**
 * Finance Adjustment System — Admin -> Finance's Charge/Credit/Refund
 * Adjustment records. Distinct from types/refund.ts's RefundRequest (a
 * refund's own Pending->Approved->Processing->Refunded/Failed/Rejected
 * lifecycle against a payment gateway) — a "refund_adjustment" here is a
 * Finance-entered REDUCTION applied on top of a refund's otherwise-eligible
 * amount (damage, restocking fee, etc.), read by
 * lib/refund-service.ts's computeRefundBreakdown, not a refund itself.
 */
export type AdjustmentType = "charge" | "credit" | "refund_adjustment"

/**
 * Pending -> Approved (effect applied + document generated) or Rejected
 * (terminal, no effect). There is no "edit" or "delete" — see
 * types/finance.ts's own FinanceAdjustment doc comment: a correction is a
 * new adjustment that reverses this one, never a mutation of it.
 */
export type AdjustmentStatus = "Pending" | "Approved" | "Rejected"

export type AdjustmentParty = "buyer" | "seller"

/**
 * Firestore `financeAdjustments/{id}` — immutable once written; only new
 * fields are ever appended via status transition (Pending -> Approved/
 * Rejected), never a value already set. `amount` is always a positive
 * magnitude — the caller enters "Charge ₹100", never "-₹100"; every
 * consumer (lib/wallet-service.ts, lib/refund-service.ts) applies the sign
 * itself based on `type` (charge/refund_adjustment subtract, credit adds —
 * see signedAmount() below).
 */
export interface FinanceAdjustment {
  id: string
  /** Sequential, human-readable id (ADJnnnn) minted once at creation — see
   * lib/sequential-id.ts. Reused verbatim as the documentNumber of the
   * Debit/Credit Adjustment Statement generated on approval
   * (lib/finance-documents.ts) — one adjustment, one number, everywhere. */
  adjustmentNumber: string
  /** Set for a seller charge/credit tied to one settlement, or a
   * refund_adjustment (always order-scoped). Omitted only for a rare
   * seller-wide (not order-specific) charge/credit. */
  orderId?: string
  partyType: AdjustmentParty
  /** sellerId for partyType "seller", buyerId for partyType "buyer". */
  partyId: string
  type: AdjustmentType
  /** Always a positive magnitude — see the interface doc comment above. */
  amount: number
  reason: string
  notes?: string
  status: AdjustmentStatus
  createdBy: { uid: string; email: string }
  approvedBy?: { uid: string; email: string }
  createdAt: string
  approvedAt?: string
  /** Point-in-time snapshot of the affected balance immediately before this
   * adjustment — for charge/credit, the seller's payable for this scope
   * (order-scoped settlement or seller-wide wallet balance); for
   * refund_adjustment, the order's eligible refund amount. A snapshot for
   * audit display, not a running ledger balance (the live figure is always
   * recomputed fresh — lib/wallet-service.ts / lib/refund-service.ts). */
  previousBalance: number
  /** previousBalance with this adjustment's signed amount applied. */
  newBalance: number
  /** Settlement/withdrawal id this charge or credit is attributed to, if any. */
  relatedPaymentId?: string
  /** Set once Approved — the generated FinanceDocument's id (types/finance-document.ts). */
  relatedDocumentId?: string
  /** Set only when this adjustment exists to reverse an earlier one — points
   * at that adjustment's id. The reversed adjustment is never edited; this
   * is the "reversing adjustment instead of a silent edit" mechanism. */
  reversesAdjustmentId?: string
}

export interface FinanceAdjustmentInput {
  orderId?: string
  partyType: AdjustmentParty
  partyId: string
  type: AdjustmentType
  amount: number
  reason: string
  notes?: string
  relatedPaymentId?: string
  reversesAdjustmentId?: string
}

/** The signed effect of one adjustment on its target balance — charge and
 * refund_adjustment both subtract, credit adds. Never apply `amount`
 * un-signed anywhere outside this function. */
export function signedAmount(type: AdjustmentType, amount: number): number {
  return type === "credit" ? amount : -amount
}
