"use client"

import { useRouter } from "next/navigation"
import { ShoppingCart, Zap } from "lucide-react"
import { useStore } from "@/components/store-provider"
import type { Product } from "@/lib/products"

/**
 * Add to Cart / Buy Now — compact, always on one row, never wraps. Used by
 * every product card on the site so the layout and colors never drift.
 */
export function ProductCardActions({ product }: { product: Product }) {
  const router = useRouter()
  const { addToCart } = useStore()

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product, product.sizes[0], product.colors[0])
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product, product.sizes[0], product.colors[0])
    router.push("/checkout")
  }

  return (
    <div className="mt-2.5 flex flex-nowrap gap-1.5 sm:mt-3 sm:gap-2">
      <button
        type="button"
        onClick={handleAddToCart}
        className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-[#16a34a] px-1 text-xs font-semibold text-white transition hover:brightness-110 sm:h-10 sm:text-sm"
      >
        <ShoppingCart className="size-3.5 shrink-0 sm:size-4" />
        <span className="truncate">Add</span>
      </button>
      <button
        type="button"
        onClick={handleBuyNow}
        className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-[#f97316] px-1 text-xs font-semibold text-white transition hover:brightness-110 sm:h-10 sm:text-sm"
      >
        <Zap className="size-3.5 shrink-0 sm:size-4" />
        <span className="truncate">Buy</span>
      </button>
    </div>
  )
}
