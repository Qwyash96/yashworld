/**
 * Firestore `reviews/{orderId}_{productId}` — doc ID convention enforces
 * "one review per purchased item" for free. Public read (see
 * firestore.rules) — reviews go live immediately on submission, no
 * approval queue; admin moderation is delete-only, matching the rule's
 * existing shape.
 */
export interface Review {
  id: string
  orderId: string
  productId: string
  buyerId: string
  buyerName: string
  rating: number
  text: string
  images: string[]
  sellerReply?: string
  createdAt: string
  updatedAt: string
}

export type ReviewInput = {
  orderId: string
  productId: string
  rating: number
  text: string
  images: string[]
}
