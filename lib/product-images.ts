import type { ProductImage } from "@/types/product"

/**
 * Coerces a product's `images` field into the canonical ProductImage[] shape
 * regardless of whether it's already that shape or the older plain
 * string[]-of-URLs shape. Every Firestore read of a product goes through
 * this — see services/product.service.ts — so old documents keep working
 * without a required migration, while a real backfill (run once against
 * production) also updates the stored documents to the new shape directly.
 */
export function normalizeProductImages(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return []

  const normalized = raw
    .map((item): ProductImage | null => {
      if (typeof item === "string" && item.trim()) {
        return { url: item, isCover: false }
      }
      if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
        const candidate = item as { url: string; isCover?: unknown }
        return { url: candidate.url, isCover: !!candidate.isCover }
      }
      return null
    })
    .filter((img): img is ProductImage => !!img)

  if (normalized.length > 0 && !normalized.some((img) => img.isCover)) {
    normalized[0].isCover = true
  }

  return normalized
}

/** The URL to show as the product's thumbnail/hero image. */
export function getCoverImageUrl(images: ProductImage[]): string | undefined {
  return images.find((img) => img.isCover)?.url ?? images[0]?.url
}
