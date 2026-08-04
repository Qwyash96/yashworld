"use client"

import { useRouter } from "next/navigation"
import { ShoppingCart, Zap } from "lucide-react"
import { useStore } from "@/components/store-provider"
import type { Product } from "@/lib/products"

/**
 * Add to Cart / Buy Now — always on one row, equal width, never wraps even
 * on very narrow screens (padding/font shrink instead). Used by every
 * product card on the site so the layout and colors never drift.
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
    <div className="mt-5 flex flex-nowrap gap-2">
      <button
        type="button"
        onClick={handleAddToCart}
        className="flex h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#16a34a] px-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 max-[320px]:gap-1 max-[320px]:text-[12px] sm:px-3"
      >
        <ShoppingCart className="size-4 shrink-0 max-[320px]:size-3.5" />
        <span className="truncate">Add to Cart</span>
      </button>
      <button
        type="button"
        onClick={handleBuyNow}
        className="flex h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 max-[320px]:gap-1 max-[320px]:text-[12px] sm:px-3"
      >
        <Zap className="size-4 shrink-0 max-[320px]:size-3.5" />
        <span className="truncate">Buy Now</span>
      </button>
    </div>
  )
}
