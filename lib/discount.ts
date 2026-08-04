/**
 * The single discount calculation used everywhere a product's price is
 * shown — product cards, product detail, cart, admin/seller previews, the
 * seller product form's live preview, everywhere. Never reimplement this
 * inline; import it.
 */
export function calculateDiscountPercent(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price) return 0
  return Math.round(((originalPrice - price) / originalPrice) * 100)
}

/** Rupee amount saved — only meaningful when calculateDiscountPercent(...) > 0. */
export function calculateSavings(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price) return 0
  return originalPrice - price
}
