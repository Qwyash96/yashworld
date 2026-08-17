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
        const candidate = item as { url: string; isCover?: unknown; originalUrl?: unknown; width?: unknown; height?: unknown }
        return {
          url: candidate.url,
          isCover: !!candidate.isCover,
          ...(typeof candidate.originalUrl === "string" ? { originalUrl: candidate.originalUrl } : {}),
          ...(typeof candidate.width === "number" ? { width: candidate.width } : {}),
          ...(typeof candidate.height === "number" ? { height: candidate.height } : {}),
        }
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

// A very wide (e.g. 2000x600) or very tall (e.g. 600x2000) source photo
// would otherwise force a pathologically short/tall gallery container —
// clamped to a 3:4..4:3 band so the container still leans toward the
// photo's real orientation (landscape stays wider than portrait) without
// ever becoming an unusable sliver. object-contain (ProductImage) still
// shows the complete, undistorted photo either way; this only controls how
// much letterboxing the container itself has room for.
const MIN_ASPECT_RATIO = 3 / 4
const MAX_ASPECT_RATIO = 4 / 3
const DEFAULT_ASPECT_RATIO = 4 / 5

/** width/height → a gallery-safe aspect ratio, clamped to a sane range.
 * Falls back to the site's existing default (4:5) when dimensions aren't
 * known — true for every image uploaded before this feature existed. */
export function getImageAspectRatio(image: Pick<ProductImage, "width" | "height"> | undefined): number {
  if (!image?.width || !image?.height) return DEFAULT_ASPECT_RATIO
  const raw = image.width / image.height
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, raw))
}
