"use client"

import Link from "next/link"
import { useState } from "react"
import { Heart, Star, Eye, GitCompareArrows } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { calculateDiscountPercent } from "@/lib/discount"
import { Price, DiscountBadge } from "@/components/price"
import { ProductCardActions } from "@/components/product-card-actions"
import { ProductImage } from "@/components/product-image"
import { QuickView } from "@/components/quick-view"
import { cn } from "@/lib/utils"

/** Dense, premium-app-style product card — image, name (2-line clamp),
 * rating, price/discount, and compact Add to Cart / Buy Now, in as little
 * vertical space as the content allows. Wishlist sits in the primary corner;
 * Compare/Quick View are kept (real, working features) as a smaller,
 * secondary pair so they don't compete for space with wishlist. */
export function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted, toggleCompare, isCompared } = useStore()
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)
  const discountPercent = calculateDiscountPercent(product.price, product.originalPrice)

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/products/${product.id}`} className="relative block aspect-square overflow-hidden">
        <ProductImage src={product.image} alt={product.name} className="absolute inset-0" padding="xs" />

        {discountPercent > 0 && (
          <DiscountBadge percent={discountPercent} className="absolute left-1.5 top-1.5 shadow-sm" />
        )}

        <button
          onClick={(e) => {
            e.preventDefault()
            toggleWishlist(product)
          }}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110"
        >
          <Heart className={cn("size-3.5", wishlisted ? "fill-red-500 text-red-500" : "text-gray-500")} />
        </button>

        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault()
              toggleCompare(product)
            }}
            aria-label={compared ? "Remove from compare" : "Add to compare"}
            className="flex size-5 items-center justify-center rounded-full bg-white/95 shadow-sm"
          >
            <GitCompareArrows className={cn("size-3", compared ? "text-green-600" : "text-gray-500")} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              setQuickViewOpen(true)
            }}
            aria-label="Quick view"
            className="flex size-5 items-center justify-center rounded-full bg-white/95 shadow-sm"
          >
            <Eye className="size-3 text-gray-500" />
          </button>
        </div>
      </Link>

      <div className="p-1.5 sm:p-2">
        <h3 className="line-clamp-2 text-xs font-medium leading-tight text-black sm:text-sm">{product.name}</h3>

        <div className="mt-0.5 flex items-center gap-0.5 text-[11px]">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold text-black">{product.rating}</span>
          <span className="text-[#888888]">({product.reviews})</span>
        </div>

        <Price price={product.price} originalPrice={product.originalPrice} size="sm" className="mt-0.5" />

        <ProductCardActions product={product} />
      </div>

      <QuickView product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </div>
  )
}
