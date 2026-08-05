import type { Address } from "./user"
import type {
  OrderStatus,
  OrderTimelineEvent,
  PaymentStatus,
  SellerPayoutStatus,
} from "./order-lifecycle"

// Canonical status enums live in ./order-lifecycle — re-exported here so
// existing imports of these types from "@/types/order" keep working. There
// is only one definition of each; this is not a duplicate.
export type { OrderStatus, OrderTimelineEvent, PaymentStatus, SellerPayoutStatus }

export type PaymentMethod = "cod" | "razorpay"

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
  /** Set only when Schedule Pickup went through Shiprocket's live API (Auto
   * AWB Generation) rather than manual entry — the machine-readable flag
   * app/api/seller/orders/[id]/track checks before attempting a live
   * tracking pull, since `courierPartner` itself is just a display string
   * (and for Shiprocket shipments names the actual assigned sub-carrier,
   * e.g. "Delhivery Surface", not "Shiprocket"). */
  shippingProvider?: "shiprocket"
  pickupDate?: string
  pickupTime?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  returnedAt?: string
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
  /** Set only for paymentMethod "razorpay" — the verified gateway order/payment pair, for reconciliation. */
  razorpayOrderId?: string
  razorpayPaymentId?: string
  /** An admin-authored note on the whole order, visible to every seller on
   * it — read-only from the seller side today; no admin-facing editor
   * exists yet, so this is always unset until one's built. */
  adminNote?: string
  createdAt: string
}

export type OrderInput = Omit<Order, "id" | "createdAt">
