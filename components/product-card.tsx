"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, Star } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { calculateDiscountPercent } from "@/lib/discount"
import { Price, DiscountBadge } from "@/components/price"
import { ProductCardActions } from "@/components/product-card-actions"
import { cn } from "@/lib/utils"

export function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted } = useStore()

  const wishlisted = isWishlisted(product.id)
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

        <button
          onClick={(e) => {
            e.preventDefault()
            toggleWishlist(product)
          }}
          className="absolute right-4 top-4 rounded-full bg-white p-2 shadow"
        >
          <Heart
            className={cn(
              "h-5 w-5",
              wishlisted
                ? "fill-red-500 text-red-500"
                : "text-gray-600"
            )}
          />
        </button>
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

        <ProductCardActions product={product} />

      </div>
    </div>
  )
}
