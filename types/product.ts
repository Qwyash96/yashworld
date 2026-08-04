export type ProductStatus = "draft" | "pending" | "approved" | "rejected"

export type LightRequirement = "low" | "medium" | "bright"
export type CareDifficulty = "easy" | "moderate" | "hard"
export type PlantSize = "small" | "medium" | "large"

export interface PlantAttributes {
  light: LightRequirement
  wateringFrequencyDays: number
  petSafe: boolean
  difficulty: CareDifficulty
  size: PlantSize
  indoor: boolean
}

/** One uploaded product image — a Firebase Storage download URL plus which
 * one is the cover. Exactly one entry should have isCover: true. */
export interface ProductImage {
  url: string
  isCover: boolean
}

/** A seller-set, time-boxed sale price — "Scheduled Offers". Always
 * re-validated against startAt/endAt at read time (see
 * lib/pricing-engine.ts); an expired one is simply ignored, no cleanup job
 * needed. */
export interface ScheduledOffer {
  price: number
  startAt: string
  endAt: string
}

/** Denormalized onto the product when a seller joins a campaign (see
 * app/api/seller/campaigns/[id]/join), so listings can show campaign
 * pricing without a query per product. Always re-validated against its own
 * endAt at read time — an ended campaign's price is never trusted past
 * that, in display or in the pricing engine. */
export interface CampaignOffer {
  campaignId: string
  price: number
  endAt: string
}

/**
 * Firestore `products/{id}` document shape.
 * `lib/products.ts` still owns the current runtime Product type used by the UI;
 * this is the target shape for when Product Management goes live.
 */
export interface Product {
  id: string
  sellerId: string
  name: string
  slug: string
  categoryId: string
  price: number
  originalPrice?: number
  stock: number
  /** Older documents may still have this as a plain string[] of URLs —
   * always read through lib/product-images.ts's normalizeProductImages()
   * rather than trusting the raw Firestore shape. */
  images: ProductImage[]
  description: string
  plantAttrs: PlantAttributes
  status: ProductStatus
  /** Set when status is "rejected"; cleared on approval. */
  rejectionReason?: string
  scheduledOffer?: ScheduledOffer
  campaignOffer?: CampaignOffer
  ratingAvg: number
  ratingCount: number
  /** Cumulative units sold, incremented inside lib/order-finalize.ts's
   * checkout transaction — never decremented on cancellation (mirrors
   * `stock`'s existing behavior). Powers the admin dashboard's Top Selling
   * Products tile. */
  unitsSold: number
  createdAt: string
}

export type ProductInput = Omit<Product, "id" | "ratingAvg" | "ratingCount" | "unitsSold" | "createdAt">
