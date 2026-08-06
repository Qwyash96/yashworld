import type { Address } from "./user"
import type {
  OrderStatus,
  OrderTimelineEvent,
  PaymentStatus,
  RefundStatus,
  SellerPayoutStatus,
} from "./order-lifecycle"

// Canonical status enums live in ./order-lifecycle — re-exported here so
// existing imports of these types from "@/types/order" keep working. There
// is only one definition of each; this is not a duplicate.
export type { OrderStatus, OrderTimelineEvent, PaymentStatus, RefundStatus, SellerPayoutStatus }

export type PaymentMethod = "cod" | "razorpay" | "cashfree" | "phonepe" | "payu" | "stripe" | "paypal"

/** Any PaymentMethod that isn't "cod" — i.e. one the payment router
 * (lib/payment-router.ts) actually processes through a gateway adapter. */
export type PaymentGatewayId = Exclude<PaymentMethod, "cod">
export const PAYMENT_GATEWAY_IDS: PaymentGatewayId[] = ["razorpay", "cashfree", "phonepe", "payu", "stripe", "paypal"]

export type ShippingMethod = "standard" | "express"

/** Which pricing-engine source won the "best discount wins" comparison for
 * this line item — see lib/pricing-engine.ts. "none" means the item sold at
 * its plain listed price. */
export type DiscountSource =
  | "none"
  | "seller_price"
  | "scheduled_offer"
  | "campaign"
  | "seller_coupon"

export interface OrderItem {
  productId: string
  sellerId: string
  quantity: number
  /** Final unit price actually charged, post-best-discount. */
  price: number
  /** Pre-discount unit price, set only when discountSource !== "none". */
  originalPrice?: number
  discountSource?: DiscountSource
  /** Set only when discountSource is "seller_coupon". */
  couponCode?: string
}

/** One seller's portion of a multi-vendor order — independently fulfillable. */
export interface SellerOrder {
  sellerId: string
  items: OrderItem[]
  status: OrderStatus
  /** One entry appended by app/api/seller/orders/[id]/status on every real
   * transition — the seller-facing Tracking Timeline reads this directly. */
  timeline?: OrderTimelineEvent[]
  /** The courier's AWB / tracking number — set when Schedule Pickup is submitted. */
  trackingNumber?: string
  /** Set once a courier is assigned via Schedule Pickup. */
  courierPartner?: string
  /** Set only when Schedule Pickup went through a courier's live API (Auto
   * AWB Generation) rather than manual entry — the machine-readable flag
   * app/api/seller/orders/[id]/track checks before attempting a live
   * tracking pull, since `courierPartner` itself is just a display string
   * (and for Shiprocket shipments names the actual assigned sub-carrier,
   * e.g. "Delhivery Surface", not "Shiprocket"). See lib/shipping-service.ts
   * for the common interface every auto-AWB-capable provider implements. */
  shippingProvider?: "shiprocket" | "amazon-shipping" | "ekart" | "shift-logistics"
  /** The provider's own internal shipment id (distinct from trackingNumber,
   * the AWB) — some couriers' cancel/label endpoints operate on this rather
   * than the AWB. Only set alongside shippingProvider. */
  providerShipmentId?: string
  pickupDate?: string
  pickupTime?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  returnedAt?: string
  /** Who cancelled this seller-order — "buyer" for a self-serve cancel via
   * app/api/orders/[id]/cancel, or a seller uid for a seller-initiated cancel
   * via app/api/seller/orders/[id]/status. Unset for non-cancelled orders. */
  cancelledBy?: "buyer" | string
  /** Buyer- or seller-supplied reason text, set alongside cancelledBy/cancelledAt. */
  cancellationReason?: string
  /** Set to "Pending" when a buyer self-cancels a paymentMethod "razorpay"
   * order that was already Paid — signals Admin's Refunds module to process
   * the gateway refund. Left unset for cod orders (nothing was collected)
   * and for seller-initiated cancels before payment capture. */
  refundStatus?: RefundStatus
  /** Set when the seller rejects a Pending order. */
  rejectionReason?: string
  /** Seller-side money flow for this seller's portion of the order. */
  payoutStatus?: SellerPayoutStatus
  /** Platform commission on this seller's item revenue, at the rate active when the order was placed. */
  commissionAmount: number
  /** itemRevenue - commissionAmount. Computed BEFORE any order-level global
   * coupon discount — an admin-issued global coupon is platform marketing
   * spend and never reduces what a seller is owed (see lib/pricing-engine.ts). */
  payoutAmount: number
  /** A seller's own private note on their portion of the order (packing
   * instructions, a reminder, etc.) — never shown to the buyer. Set via
   * app/api/seller/orders/[id]/note. */
  note?: string
}

/** Firestore `orders/{id}` document shape. */
export interface Order {
  id: string
  buyerId: string
  /** Contact email for order communications — may differ from the account email. */
  contactEmail: string
  sellerOrders: SellerOrder[]
  /** Denormalized from sellerOrders[].sellerId — lets a seller query their own orders via array-contains. */
  sellerIds: string[]
  status: OrderStatus
  totals: {
    subtotal: number
    /** Order-level discount only — i.e. an applied global coupon. Per-item
     * seller/campaign/seller-coupon discounts are already reflected in each
     * OrderItem.price and don't appear here separately. */
    discount: number
    shipping: number
    total: number
  }
  /** Set only when an admin global coupon was applied at checkout. */
  appliedCouponCode?: string
  /** Denormalized set of campaign IDs that discounted at least one item in
   * this order — Firestore can't query nested array-of-object fields, so
   * this (array-contains-queryable) is how admin campaign analytics finds
   * "orders influenced by campaign X" without scanning every order. */
  campaignIds?: string[]
  /** True while any sellerOrders[].payoutStatus == "Hold" — same
   * "Firestore can't query inside an array of objects" reason as
   * campaignIds above. Lets app/api/admin/wallets/release-holds find
   * candidates without scanning every order. Set/cleared by
   * app/api/seller/orders/[id]/status/route.ts. */
  hasHeldPayouts?: boolean
  shippingAddress: Address
  shippingMethod: ShippingMethod
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Which gateway actually processed this payment — set for every non-cod
   * order going forward, chosen by lib/payment-router.ts at checkout time,
   * never client-supplied. Equal to `paymentMethod` for any non-cod order
   * (paymentMethod IS the gateway id here; kept as two fields since
   * paymentMethod predates the multi-gateway router and other code already
   * reads it as "how did the buyer pay"). Used by the admin refund flow and
   * order-status sync to know which adapter to call. */
  gatewayId?: PaymentGatewayId
  gatewayOrderId?: string
  gatewayPaymentId?: string
  /** Deprecated aliases of gatewayOrderId/gatewayPaymentId — still populated
   * for paymentMethod "razorpay" orders (old and new) so existing readers
   * (admin refund route, invoice/document context, the legacy Razorpay
   * webhook receiver) keep resolving them without changes. New code should
   * read gatewayOrderId/gatewayPaymentId instead. */
  razorpayOrderId?: string
  razorpayPaymentId?: string
  /** An admin-authored note on the whole order, visible to every seller on
   * it — read-only from the seller side today; no admin-facing editor
   * exists yet, so this is always unset until one's built. */
  adminNote?: string
  createdAt: string
}

export type OrderInput = Omit<Order, "id" | "createdAt">
