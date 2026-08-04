import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { getPlatformSettings } from "@/lib/platform-settings"
import { getValidCoupon } from "@/lib/coupons"
import { buildBaseCandidates, pickBestCandidate, type PriceCandidate } from "@/lib/price-candidates"
import type { Product } from "@/types/product"
import type { DiscountSource } from "@/types/order"
import type { Coupon } from "@/types/coupon"
import type { DiscountType } from "@/types/campaign"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export class InsufficientStockError extends Error {
  constructor(public productName: string, public available: number) {
    super(`"${productName}" only has ${available} left in stock.`)
  }
}

/** Pure — no I/O. The rupee amount a discount rule removes from `base`,
 * never more than `base` itself and never negative. */
export function calculateDiscountAmount(
  base: number,
  discountType: DiscountType,
  discountValue: number,
  maxDiscountAmount?: number,
): number {
  const raw = discountType === "flat" ? discountValue : base * (discountValue / 100)
  const capped = maxDiscountAmount !== undefined ? Math.min(raw, maxDiscountAmount) : raw
  return round2(Math.min(base, Math.max(0, capped)))
}

/**
 * Pure — no I/O. Picks the lowest price among every mechanism eligible for
 * this product right now ("best single discount wins" — never stacked):
 * the seller's own listed price, an active time-boxed scheduledOffer, an
 * active denormalized campaignOffer, and — if a matching seller coupon was
 * supplied — that coupon's price. Every candidate is computed from the same
 * reference ("was") price so they're genuinely comparable.
 */
export function resolveItemPrice(
  product: Product,
  now: Date,
  sellerCoupon?: Coupon,
): { unitPrice: number; originalUnitPrice: number; discountSource: DiscountSource; couponCode?: string } {
  const originalUnitPrice = product.originalPrice ?? product.price
  const candidates: PriceCandidate[] = buildBaseCandidates(product, now)

  let couponCode: string | undefined
  if (sellerCoupon && sellerCoupon.scope === "seller" && sellerCoupon.sellerId === product.sellerId) {
    const couponPrice = originalUnitPrice - calculateDiscountAmount(
      originalUnitPrice,
      sellerCoupon.discountType,
      sellerCoupon.discountValue,
      sellerCoupon.maxDiscountAmount,
    )
    candidates.push({ price: couponPrice, source: "seller_coupon" })
  }

  const best = pickBestCandidate(candidates)
  if (best.source === "seller_coupon") couponCode = sellerCoupon!.code

  // If the "winning" price is no lower than the plain "was" price, there's
  // genuinely no discount at all — label it "none" rather than a source
  // that implies savings that don't exist.
  const discountSource: DiscountSource = best.price < originalUnitPrice ? best.source : "none"

  return { unitPrice: round2(best.price), originalUnitPrice, discountSource, couponCode }
}

export interface PricingLineInput {
  product: Product
  quantity: number
}

export interface PricingLineResult {
  productId: string
  sellerId: string
  quantity: number
  unitPrice: number
  originalUnitPrice: number
  discountSource: DiscountSource
  couponCode?: string
}

export interface SellerPricingResult {
  sellerId: string
  /** Sum of unitPrice * quantity for this seller — BEFORE any order-level global-coupon discount. */
  itemRevenue: number
  commissionAmount: number
  /** itemRevenue - commissionAmount. Never reduced by a global coupon — see module doc. */
  payoutAmount: number
}

export interface OrderPricingResult {
  items: PricingLineResult[]
  subtotal: number
  /** Order-level discount only — an applied GLOBAL (admin) coupon. Seller-coupon/campaign/scheduled-offer discounts are already inside each item's unitPrice. */
  discount: number
  appliedCouponCode?: string
  campaignIds: string[]
  sellerBreakdown: SellerPricingResult[]
  commissionRatePercent: number
}

/**
 * Pure — no I/O. The actual math, given already-fetched data. Used both by
 * the transactional path in lib/order-finalize.ts (which fetches
 * products/coupon/commission inside its own transaction for atomicity) and
 * by the read-only wrapper below (for the checkout price-preview route).
 *
 * Admin-issued GLOBAL coupons are the platform's own marketing spend: they
 * reduce what the buyer pays (an order-level `discount` line) but never
 * reduce a seller's payoutAmount, which is computed from each item's own
 * unitPrice regardless. A SELLER's own coupon, by contrast, changes that
 * item's unitPrice directly (via resolveItemPrice above), so it naturally
 * flows into that seller's payout — it's their own promotional spend.
 */
export function computeOrderPricingFromData(
  items: PricingLineInput[],
  commissionRatePercent: number,
  coupon: Coupon | null,
  now: Date,
): OrderPricingResult {
  const sellerCoupon = coupon?.scope === "seller" ? coupon : undefined

  const resolvedItems: PricingLineResult[] = items.map(({ product, quantity }) => {
    const resolved = resolveItemPrice(product, now, sellerCoupon)
    return {
      productId: product.id,
      sellerId: product.sellerId,
      quantity,
      unitPrice: resolved.unitPrice,
      originalUnitPrice: resolved.originalUnitPrice,
      discountSource: resolved.discountSource,
      ...(resolved.couponCode ? { couponCode: resolved.couponCode } : {}),
    }
  })

  const subtotal = round2(resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))

  let discount = 0
  let appliedCouponCode: string | undefined
  if (coupon?.scope === "global") {
    const eligible = !coupon.minOrderValue || subtotal >= coupon.minOrderValue
    if (eligible) {
      discount = calculateDiscountAmount(subtotal, coupon.discountType, coupon.discountValue, coupon.maxDiscountAmount)
      appliedCouponCode = coupon.code
    }
  } else if (sellerCoupon && resolvedItems.some((item) => item.discountSource === "seller_coupon")) {
    appliedCouponCode = sellerCoupon.code
  }

  const campaignIds = Array.from(
    new Set(
      items
        .filter((_, i) => resolvedItems[i].discountSource === "campaign")
        .map(({ product }) => product.campaignOffer?.campaignId)
        .filter((id): id is string => !!id),
    ),
  )

  const revenueBySeller = new Map<string, number>()
  for (const item of resolvedItems) {
    revenueBySeller.set(item.sellerId, (revenueBySeller.get(item.sellerId) ?? 0) + item.unitPrice * item.quantity)
  }
  const commissionRate = commissionRatePercent / 100
  const sellerBreakdown: SellerPricingResult[] = Array.from(revenueBySeller.entries()).map(([sellerId, itemRevenue]) => {
    const commissionAmount = round2(itemRevenue * commissionRate)
    return { sellerId, itemRevenue: round2(itemRevenue), commissionAmount, payoutAmount: round2(itemRevenue - commissionAmount) }
  })

  return { items: resolvedItems, subtotal, discount, appliedCouponCode, campaignIds, sellerBreakdown, commissionRatePercent }
}

/**
 * Read-only convenience wrapper — fetches products/commission/coupon itself
 * (NOT inside a transaction), for the checkout price-preview endpoint where
 * a momentary staleness is acceptable (the buyer hasn't paid yet; the real,
 * transactional recomputation happens in lib/order-finalize.ts at
 * order-creation time, exactly like computeTrustedTotal already works today).
 */
export async function computeOrderPricing(
  items: { productId: string; quantity: number }[],
  options: { couponCode?: string; now?: Date } = {},
): Promise<OrderPricingResult> {
  const now = options.now ?? new Date()
  const db = getAdminDb()

  const [productSnaps, settings, coupon] = await Promise.all([
    db.getAll(...items.map((item) => db.collection("products").doc(item.productId))),
    getPlatformSettings(),
    options.couponCode ? getValidCoupon(options.couponCode, now) : Promise.resolve(null),
  ])

  const lineInputs: PricingLineInput[] = productSnaps.map((snap, i) => {
    if (!snap.exists) throw new Error(`Product not found: ${items[i].productId}`)
    const product = { id: snap.id, ...snap.data() } as Product
    if (product.stock < items[i].quantity) {
      throw new InsufficientStockError(product.name, product.stock)
    }
    return { product, quantity: items[i].quantity }
  })

  return computeOrderPricingFromData(lineInputs, settings.defaultCommissionPercent, coupon, now)
}
