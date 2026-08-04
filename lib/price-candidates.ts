import type { DiscountSource } from "@/types/order"

export interface PriceCandidate {
  price: number
  source: DiscountSource
}

export interface CandidateProduct {
  price: number
  scheduledOffer?: { price: number; startAt: string; endAt: string }
  campaignOffer?: { price: number; endAt: string }
}

/**
 * The non-coupon candidates for the "best single discount wins" comparison —
 * the seller's own listed price, plus a still-in-window scheduled offer
 * and/or a still-valid campaign price. Shared by the trusted pricing engine
 * (lib/pricing-engine.ts, server-only, which adds a coupon candidate on top
 * when one applies) and the plain catalog display mapping
 * (services/catalog.service.ts — display-only, no coupon since none has
 * been entered yet), so the two can never disagree about which discount is
 * currently winning.
 */
export function buildBaseCandidates(product: CandidateProduct, now: Date): PriceCandidate[] {
  const candidates: PriceCandidate[] = [{ price: product.price, source: "seller_price" }]
  if (
    product.scheduledOffer &&
    new Date(product.scheduledOffer.startAt) <= now &&
    new Date(product.scheduledOffer.endAt) >= now
  ) {
    candidates.push({ price: product.scheduledOffer.price, source: "scheduled_offer" })
  }
  if (product.campaignOffer && new Date(product.campaignOffer.endAt) >= now) {
    candidates.push({ price: product.campaignOffer.price, source: "campaign" })
  }
  return candidates
}

export function pickBestCandidate(candidates: PriceCandidate[]): PriceCandidate {
  return candidates.reduce((lowest, candidate) => (candidate.price < lowest.price ? candidate : lowest))
}
