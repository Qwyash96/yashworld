import Image from "next/image"
import { cn } from "@/lib/utils"

const PADDING = {
  none: "p-0",
  xs: "p-0.5",
  sm: "p-1.5",
  md: "p-3",
  lg: "p-6",
} as const

/**
 * The one product-image container used everywhere a product photo renders —
 * card grids, product detail, quick view, cart, wishlist, compare, seller
 * dashboard, admin dashboard, sponsored slots. Amazon/Flipkart-style
 * "letterboxed" fit: the full photo always shows (object-contain, never
 * object-cover), centered on a white tile, at whatever fixed size the
 * caller's `className` sets on the container — the image adapts to the
 * tile, the tile never adapts to the image. `padding` controls the inset
 * that keeps a photo from touching the tile's edges, scaled to the tile's
 * own size (a size-12 order-row thumbnail and a full product-detail hero
 * both feel "centered with breathing room," not stretched to the corners).
 *
 * Upscale ceiling: object-contain's own hard limit is the tile itself — a
 * small source image is scaled up only as far as filling the tile allows
 * and never beyond it, so a tiny source is at worst "as pixelated as
 * filling this exact tile requires," never bigger. Precisely capping
 * upscale relative to an image's *original* resolution (e.g. "never more
 * than 2x its native size") would need each image's natural dimensions
 * known ahead of render (stored at upload time or measured client-side on
 * load) — real, buildable, but a separate feature from this component; ask
 * if you want it.
 */
export function ProductImage({
  src,
  alt,
  className,
  padding = "md",
  priority,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
}: {
  src: string | undefined
  alt: string
  className?: string
  padding?: keyof typeof PADDING
  priority?: boolean
  sizes?: string
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      <Image
        src={src || "/placeholder.svg"}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-contain", PADDING[padding])}
      />
    </div>
  )
}
