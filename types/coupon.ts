import type { DiscountType } from "@/types/campaign"

export type CouponScope = "seller" | "global"
export type CouponStatus = "active" | "paused" | "expired"

/** Firestore `coupons/{CODE}` — doc ID is the uppercased code itself, so
 * uniqueness and lookup are both free. `scope` disambiguates a seller's own
 * coupon from an admin-issued platform-wide one; a "global" coupon can only
 * ever be created/edited by an admin (see firestore.rules). */
export interface Coupon {
  code: string
  scope: CouponScope
  /** Set only when scope === "seller" — that seller's uid. */
  sellerId?: string
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount?: number
  /** Order subtotal required to use this coupon — only meaningful for "global" scope, checked cart-wide. */
  minOrderValue?: number
  /** Total redemptions allowed across all buyers — unset means unlimited. */
  usageLimit?: number
  usageLimitPerBuyer?: number
  usedCount: number
  /** Running totals, incremented alongside usedCount on each redemption —
   * this is a seller's/admin's offer-analytics source, no order-scanning needed. */
  totalDiscountGiven: number
  totalRevenue: number
  startAt: string
  endAt: string
  status: CouponStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CouponInput = Omit<
  Coupon,
  "usedCount" | "totalDiscountGiven" | "totalRevenue" | "createdAt" | "updatedAt"
>

/** Firestore `couponRedemptions/{orderId}_{couponId}` — audit trail + the
 * source of truth for a buyer's per-coupon usage count. */
export interface CouponRedemption {
  orderId: string
  couponCode: string
  buyerId: string
  discountAmount: number
  redeemedAt: string
}
