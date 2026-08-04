"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Heart, Star, Eye, GitCompareArrows, Truck, Store } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { calculateDiscountPercent } from "@/lib/discount"
import { Price, DiscountBadge } from "@/components/price"
import { ProductCardActions } from "@/components/product-card-actions"
import { QuickView } from "@/components/quick-view"
import { getDeliveryEstimate } from "@/lib/delivery-estimate"
import { cn } from "@/lib/utils"

export function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted, toggleCompare, isCompared } = useStore()
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)
  const discountPercent = calculateDiscountPercent(product.price, product.originalPrice)

  return (
    <div className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
      <Link
        href={`/products/${product.id}`}
        className="relative block h-72 overflow-hidden bg-gray-100"
      >
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-110"
        />

        {discountPercent > 0 && (
          <DiscountBadge percent={discountPercent} className="absolute left-4 top-4 shadow" />
        )}

        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              toggleWishlist(product)
            }}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className="rounded-full bg-white p-2 shadow transition hover:scale-110"
          >
            <Heart className={cn("h-5 w-5", wishlisted ? "fill-red-500 text-red-500" : "text-gray-600")} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              toggleCompare(product)
            }}
            aria-label={compared ? "Remove from compare" : "Add to compare"}
            className="rounded-full bg-white p-2 shadow transition hover:scale-110"
          >
            <GitCompareArrows className={cn("h-5 w-5", compared ? "text-green-600" : "text-gray-600")} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              setQuickViewOpen(true)
            }}
            aria-label="Quick view"
            className="rounded-full bg-white p-2 shadow transition hover:scale-110"
          >
            <Eye className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </Link>

      <div className="p-5">
        <p className="text-sm text-green-600 font-semibold uppercase">
          {product.category}
        </p>

        <h3 className="mt-2 text-xl font-bold text-black line-clamp-2">
          {product.name}
        </h3>

        <div className="mt-3 flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-black">{product.rating}</span>
          <span className="text-[#444444]">
            ({product.reviews})
          </span>
        </div>

        <Price price={product.price} originalPrice={product.originalPrice} size="md" className="mt-4" />

        <div className="mt-3 flex flex-col gap-1 text-xs text-[#444444]">
          <span className="flex items-center gap-1.5">
            <Truck className="size-3.5 shrink-0 text-green-700" />
            {getDeliveryEstimate()}
          </span>
          {product.sellerName && (
            <span className="flex items-center gap-1.5 truncate">
              <Store className="size-3.5 shrink-0 text-green-700" />
              Sold by {product.sellerName}
            </span>
          )}
        </div>

        <ProductCardActions product={product} />
      </div>

      <QuickView product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </div>
  )
}
