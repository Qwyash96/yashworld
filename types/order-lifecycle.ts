// ============================================================================
// YashWorld Marketplace — Canonical Order Lifecycle Architecture
// ============================================================================
// Single source of truth for every order-related status vocabulary and the
// business rules that govern them. There is exactly ONE Order model in this
// project — types/order.ts's `Order` / `SellerOrder` — and exactly one
// status enum per concern, all defined here. Every future Buyer, Seller and
// Admin page (and the future Razorpay/Firebase integrations) must be built
// against these types rather than inventing ad-hoc status strings.
//
// Types + pure business-rule functions only — no storage, no Firebase, no
// Razorpay. services/order.service.ts and lib/order-finalize.ts are the
// Firestore-backed implementation of these rules.

/**
 * The single order status field. Return and replacement sub-flows are
 * states of this SAME enum (not a separate ReturnStatus/ReplacementStatus) —
 * there is only ever one status per order.
 */
export type OrderStatus =
  | "Pending"
  | "Accepted"
  | "Packing"
  | "Ready To Ship"
  | "Shipped"
  | "Out For Delivery"
  | "Delivered"
  | "Cancelled"
  | "Return Requested"
  | "Return Approved"
  | "Return Rejected"
  | "Pickup Scheduled"
  | "Picked Up"
  | "Refunded"
  | "Replacement Requested"
  | "Replacement Approved"
  | "Replacement Rejected"
  | "Completed"

/** The forward fulfilment path a seller pushes an order through, in order. */
export const ORDER_FULFILMENT_SEQUENCE: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Packing",
  "Ready To Ship",
  "Shipped",
  "Out For Delivery",
  "Delivered",
]

const CANCELLABLE_STATUSES = new Set<OrderStatus>(["Pending", "Accepted", "Packing", "Ready To Ship"])

/** Rule: Cancel allowed only before shipping. */
export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.has(status)
}

export const RETURN_WINDOW_DAYS = 7
export const REPLACEMENT_WINDOW_DAYS = 10

/** Rule: Return allowed only within the return window after delivery. */
export function isReturnEligible(
  status: OrderStatus,
  deliveredAt: string | undefined,
  now: Date = new Date()
): boolean {
  if (status !== "Delivered" || !deliveredAt) return false
  const daysSinceDelivery = (now.getTime() - new Date(deliveredAt).getTime()) / 86_400_000
  return daysSinceDelivery <= RETURN_WINDOW_DAYS
}

/** Rule: Replacement allowed only within the replacement window after delivery. */
export function isReplacementEligible(
  status: OrderStatus,
  deliveredAt: string | undefined,
  now: Date = new Date()
): boolean {
  if (status !== "Delivered" || !deliveredAt) return false
  const daysSinceDelivery = (now.getTime() - new Date(deliveredAt).getTime()) / 86_400_000
  return daysSinceDelivery <= REPLACEMENT_WINDOW_DAYS
}

export interface OrderTimelineEvent {
  status: OrderStatus
  at: string
  note?: string
}

/** Buyer's payment collection status — separate concern from order fulfilment. */
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded"

/** Standardized Refund Status — used by the admin Refunds module. */
export type RefundStatus = "None" | "Pending" | "Approved" | "Rejected" | "Completed"

/**
 * Standardized Seller Payout Status — the single linear progression of a
 * seller-order's money, from order placement through to bank transfer.
 * Replaces the old separate "payment escrow" concept entirely: there is one
 * payout status per seller-order, and it is also what a withdrawal
 * PayoutRequest's own status is drawn from.
 */
export type SellerPayoutStatus = "Pending" | "Hold" | "Released" | "Withdraw Requested" | "Paid"

/**
 * Dispute status stays a distinct enum on purpose — a dispute is a
 * complaint/investigation process, not a fulfilment state, so it isn't
 * folded into OrderStatus.
 */
export type DisputeStatus = "Open" | "Seller Replied" | "Admin Reviewing" | "Resolved"

// SellerWallet and the withdrawal-request workflow live in types/wallet.ts —
// a withdrawal request's approval status (requested/approved/paid/rejected)
// is a different concept from SellerPayoutStatus above (which describes a
// SellerOrder's money state, not a withdrawal request), so it gets its own
// status type there rather than reusing this one.

/** Return request metadata — the authoritative status lives on the Order/SellerOrder. */
export interface ReturnRequestRecord {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  reason: string
  sellerViewedAt?: string
  createdAt: string
}

/** Replacement request metadata — the authoritative status lives on the Order/SellerOrder. */
export interface ReplacementRequestRecord {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  reason: string
  createdAt: string
}

/** Refund requests always go to Admin. */
export interface RefundRecord {
  id: string
  orderId: string
  sellerId: string
  returnId?: string
  disputeId?: string
  buyerId: string
  amount: number
  status: RefundStatus
  createdAt: string
}

/** Buyer Complaint -> Seller Reply -> Admin Review -> Final Decision. */
export interface DisputeRecord {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  buyerComplaint: string
  sellerReply?: string
  adminDecision?: string
  status: DisputeStatus
  createdAt: string
}

// ---------------------------------------------------------------------------
// Permission matrix. This is documentation of intent — the real enforcement
// is server-side: services/order.service.ts and firestore.rules never expose
// a seller-callable path for any SELLER_FORBIDDEN_ACTIONS. Only admin* actions
// (Admin SDK routes) may perform them.
// ---------------------------------------------------------------------------
export const SELLER_ALLOWED_ACTIONS = [
  "view_new_orders",
  "accept_order",
  "reject_order",
  "confirm_order",
  "start_packing",
  "mark_ready_to_ship",
  "mark_shipped",
  "add_tracking_number",
  "mark_delivered",
  "print_invoice",
] as const

export const SELLER_FORBIDDEN_ACTIONS = [
  "approve_refund",
  "approve_return",
  "release_payment",
  "close_dispute",
] as const

export const ADMIN_MODULES = [
  "Orders",
  "Returns",
  "Refunds",
  "Replacement",
  "Disputes",
  "Support Tickets",
  "Seller Payouts",
  "Invoices",
] as const
