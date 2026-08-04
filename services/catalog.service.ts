import { cache } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import { normalizeProductImages, getCoverImageUrl } from "@/lib/product-images"
import { buildBaseCandidates, pickBestCandidate } from "@/lib/price-candidates"
import {
  products as fallbackProducts,
  categories as fallbackCategories,
  type Product,
  type Category,
} from "@/lib/products"
import type { Product as FirestoreProduct } from "@/types/product"

const PRODUCTS_COLLECTION = "products"
const CATEGORIES_COLLECTION = "categories"

/**
 * Maps a Firestore `products/{id}` document (types/product.ts shape, written
 * by the seller dashboard) into lib/products.ts's UI-facing Product shape,
 * so ProductCard / ProductDetail / ProductListing need no changes to render
 * real seller-created products.
 *
 * Also resolves the "best single discount wins" effective price (seller's
 * own price vs. a still-active scheduledOffer vs. a still-active
 * campaignOffer — the same non-coupon candidates lib/pricing-engine.ts uses
 * server-side) so a scheduled/campaign price shows everywhere automatically,
 * with no per-page changes needed.
 */
function toUIProduct(product: FirestoreProduct, now: Date = new Date()): Product {
  const { plantAttrs } = product
  const originalUnitPrice = product.originalPrice ?? product.price
  const best = pickBestCandidate(buildBaseCandidates(product, now))
  const effectivePrice = best.price
  const effectiveOriginalPrice = effectivePrice < originalUnitPrice ? originalUnitPrice : product.originalPrice

  return {
    id: product.id,
    name: product.name,
    price: effectivePrice,
    originalPrice: effectiveOriginalPrice,
    category: product.categoryId,
    sellerId: product.sellerId,
    image: getCoverImageUrl(product.images) ?? "/placeholder.svg",
    description: product.description,
    details: [
      `Light: ${plantAttrs.light}`,
      `Water every ${plantAttrs.wateringFrequencyDays} day${plantAttrs.wateringFrequencyDays === 1 ? "" : "s"}`,
      `Difficulty: ${plantAttrs.difficulty}`,
      plantAttrs.petSafe ? "Pet safe" : "Keep away from pets",
      plantAttrs.indoor ? "Indoor plant" : "Outdoor plant",
    ],
    colors: ["Default"],
    sizes: [plantAttrs.size],
    rating: product.ratingAvg,
    reviews: product.ratingCount,
    createdAt: product.createdAt,
  }
}

/**
 * Firestore-first product catalog with an automatic fallback to the static
 * lib/products.ts data. Only products with status "approved" are included —
 * draft/pending seller products never reach the customer catalog.
 * Never throws — any Firestore error falls back to the static catalog.
 *
 * Plain (uncached) version — use this from Client Components. React's
 * cache() below is scoped to Server Component render passes, so Client
 * Components (e.g. the homepage) call this directly instead.
 */
export async function fetchApprovedProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, PRODUCTS_COLLECTION), where("status", "==", "approved"))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return fallbackProducts
    return snapshot.docs.map((d) => {
      const data = d.data()
      return toUIProduct({ id: d.id, ...data, images: normalizeProductImages(data.images) } as FirestoreProduct)
    })
  } catch (error) {
    console.error(toServiceError("Falling back to static products", error).message)
    return fallbackProducts
  }
}

/** Same as fetchApprovedProducts, memoized per request — for Server Components. */
export const getProductCatalog = cache(fetchApprovedProducts)

/** Same Firestore-first / fallback pattern as getProductCatalog, for categories. */
export const getCategoryCatalog = cache(async (): Promise<Category[]> => {
  try {
    const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION))
    if (snapshot.empty) return fallbackCategories
    return snapshot.docs.map((d) => d.data() as Category)
  } catch (error) {
    console.error(toServiceError("Falling back to static categories", error).message)
    return fallbackCategories
  }
})
