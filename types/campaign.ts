export type CampaignType = "flash_sale" | "festival_sale" | "category_discount" | "deal_of_day"
export type DiscountType = "percent" | "flat"
export type CampaignStatus = "draft" | "scheduled" | "active" | "ended" | "cancelled"
export type CampaignEnrollmentMode = "open" | "invite_only"

/** Firestore `campaigns/{id}` — an admin-run promotion. All three "types"
 * (Flash Sale / Festival Sale / Category Discount) share this one shape;
 * `type` only drives label/icon/default copy in the UI, not separate logic. */
export interface Campaign {
  id: string
  name: string
  type: CampaignType
  discountType: DiscountType
  discountValue: number
  /** Restricts eligibility to these category slugs — unset means "any category". */
  categoryIds?: string[]
  startAt: string
  endAt: string
  status: CampaignStatus
  enrollmentMode: CampaignEnrollmentMode
  bannerImageUrl?: string
  bannerLinkUrl?: string
  /** Optional cap on the rupee amount a single item's discount can be, for percent-type campaigns. */
  maxDiscountAmount?: number
  /** Running totals, incremented transactionally inside lib/order-finalize.ts
   * whenever an order item wins this campaign's price — Firestore can't
   * query nested array-of-object fields, so this is the only practical way
   * to get fast campaign analytics without scanning every order. */
  stats?: {
    ordersCount: number
    revenue: number
    discountGiven: number
  }
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CampaignInput = Omit<Campaign, "id" | "stats" | "createdAt" | "updatedAt">

export type CampaignParticipantStatus = "invited" | "opted_in" | "declined"

/** Firestore `campaignParticipants/{campaignId}_{sellerId}`. */
export interface CampaignParticipant {
  campaignId: string
  sellerId: string
  status: CampaignParticipantStatus
  /** Which of the seller's products participate — unset/empty means all eligible products. */
  productIds?: string[]
  invitedAt?: string
  respondedAt?: string
}
