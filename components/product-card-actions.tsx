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
    <div className="mt-2 flex flex-nowrap gap-1">
      <button
        type="button"
        onClick={handleAddToCart}
        className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-[#16a34a] px-1 text-[11px] font-semibold text-white transition hover:brightness-110"
      >
        <ShoppingCart className="size-3 shrink-0" />
        <span className="truncate">Add</span>
      </button>
      <button
        type="button"
        onClick={handleBuyNow}
        className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-[#f97316] px-1 text-[11px] font-semibold text-white transition hover:brightness-110"
      >
        <Zap className="size-3 shrink-0" />
        <span className="truncate">Buy Now</span>
      </button>
    </div>
  )
}
