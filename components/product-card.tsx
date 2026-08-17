"use client"

import Link from "next/link"
import { useState } from "react"
import { Heart, Star, Eye, GitCompareArrows } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { calculateDiscountPercent } from "@/lib/discount"
import { Price, DiscountBadge } from "@/components/price"
import { ProductImage } from "@/components/product-image"
import { QuickView } from "@/components/quick-view"
import { cn } from "@/lib/utils"

/** Premium marketplace product card — large image (a good portion of the
 * card, not a cramped square), name (2-line clamp), rating, price/discount,
 * and the real seller's shop name (services/catalog.service.ts's
 * attachSellerNames — sellers/{uid}.shopName, already public data; never
 * a seller's email/phone/uid). Hidden entirely when a product has no
 * resolvable seller name, never a placeholder. Deliberately no Add to Cart
 * / Buy Now here — those live on the product detail page's sticky action
 * bar (components/product-detail.tsx) once the buyer has actually opened
 * the product, keeping the card itself a clean, tap-to-view browsing
 * surface.
 *
 * The whole card is clickable, not just the image: a single invisible
 * `<Link>` is stretched over the entire card (absolute inset-0) as a
 * SIBLING of the image/text/buttons, not their ancestor — image, name,
 * rating, price and seller text sit in `pointer-events-none` wrappers so a
 * click there passes straight through to that Link underneath, while
 * Wishlist/Compare/Quick View re-enable `pointer-events-auto` on
 * themselves so they intercept their own clicks first. This is the
 * standard "stretched link" pattern specifically to avoid nesting
 * interactive controls inside an `<a>` (invalid HTML, unreliable for
 * screen readers) while still making every non-interactive pixel of the
 * card navigate. */
export function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted, toggleCompare, isCompared } = useStore()
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)
  const discountPercent = calculateDiscountPercent(product.price, product.originalPrice)

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl">
      <Link
        href={`/products/${product.id}`}
        aria-label={product.name}
        className="absolute inset-0 z-0 cursor-pointer"
      />

      <div className="pointer-events-none relative aspect-[4/5] shrink-0 overflow-hidden bg-[#f5f7f3]">
        <ProductImage src={product.image} alt={product.name} className="absolute inset-0" padding="sm" />

        {discountPercent > 0 && (
          <DiscountBadge percent={discountPercent} className="absolute left-2 top-2 shadow-sm sm:left-2.5 sm:top-2.5" />
        )}

        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleWishlist(product)
          }}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="pointer-events-auto absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110 sm:right-2.5 sm:top-2.5 sm:size-9"
        >
          <Heart className={cn("size-4 sm:size-5", wishlisted ? "fill-red-500 text-red-500" : "text-gray-500")} />
        </button>

        <div className="pointer-events-none absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleCompare(product)
            }}
            aria-label={compared ? "Remove from compare" : "Add to compare"}
            className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-white/95 shadow-sm"
          >
            <GitCompareArrows className={cn("size-3.5", compared ? "text-green-600" : "text-gray-500")} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setQuickViewOpen(true)
            }}
            aria-label="Quick view"
            className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-white/95 shadow-sm"
          >
            <Eye className="size-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none flex flex-1 flex-col p-2.5 sm:p-3.5">
        <h3 className="line-clamp-2 min-h-[2.4em] text-[11px] font-semibold leading-tight text-black sm:text-[13px]">
          {product.name}
        </h3>

        <div className="mt-1 flex items-center gap-1 text-xs sm:text-[13px]">
          <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold text-black">{product.rating}</span>
          <span className="text-[#888888]">({product.reviews})</span>
        </div>

        <Price price={product.price} originalPrice={product.originalPrice} size="sm" className="mt-1.5" />

        {product.sellerName && (
          <p className="mt-1 truncate text-[11px] font-medium text-black sm:text-xs">by {product.sellerName}</p>
        )}
      </div>

      <QuickView product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </div>
  )
}
