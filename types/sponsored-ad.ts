export type AdDurationDays = 1 | 3 | 7 | 15 | 30
export const AD_DURATION_OPTIONS: AdDurationDays[] = [1, 3, 7, 15, 30]

export type AdPosition = "hero" | "after-trending" | "middle" | "bottom"
export const AD_POSITIONS: AdPosition[] = ["hero", "after-trending", "middle", "bottom"]
export const AD_POSITION_LABELS: Record<AdPosition, string> = {
  hero: "Position 1 — Top Hero Slider",
  "after-trending": "Position 2 — After Trending",
  middle: "Position 3 — Middle Banner",
  bottom: "Position 4 — Bottom Banner",
}

export type SponsoredAdStatus = "pending" | "paid" | "approved" | "rejected" | "running" | "expired" | "paused"

/**
 * Firestore `sponsoredAds/{id}` — a seller's paid product-promotion
 * campaign. Created and every status transition go through Admin-SDK
 * routes only (app/api/ads/*, app/api/admin/sponsored-ads/*) — the fee is
 * looked up server-side from platformSettings/adPricing, never
 * client-supplied. "running" requires BOTH status === "running" AND the
 * current time inside [startAt, endAt] — see services/sponsored-ad.service.ts.
 */
export interface SponsoredAd {
  id: string
  sellerId: string
  productId: string
  /** Denormalized at creation time so admin/seller lists never need a join. */
  productName: string
  productImage: string
  durationDays: AdDurationDays
  feeAmount: number
  position: AdPosition
  status: SponsoredAdStatus
  /** Higher runs first when multiple ads compete for the same position/slot. */
  priority: number
  /** Set once approved — the actual live window, which may be later than
   * paidAt if the admin schedules it for the future. */
  startAt?: string
  endAt?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}
