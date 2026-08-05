"use client"

import Link from "next/link"
import { Star, Heart, Truck, Store } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { Price } from "@/components/price"
import { ProductCardActions } from "@/components/product-card-actions"
import { ProductImage } from "@/components/product-image"
import { getDeliveryEstimate } from "@/lib/delivery-estimate"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

/** Product-detail-lite in a modal, triggered from ProductCard's eye icon —
 * lets a shopper preview a product without leaving the grid they're browsing. */
export function QuickView({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toggleWishlist, isWishlisted } = useStore()

  if (!product) return null
  const wishlisted = isWishlisted(product.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-xl">
            <ProductImage src={product.image} alt={product.name} className="absolute inset-0" padding="md" />
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase text-green-600">{product.category}</p>
            <h2 className="mt-1 text-xl font-bold text-black">{product.name}</h2>

            <div className="mt-2 flex items-center gap-1">
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-black">{product.rating}</span>
              <span className="text-sm text-[#444444]">({product.reviews})</span>
            </div>

            <Price price={product.price} originalPrice={product.originalPrice} size="lg" className="mt-3" showSavings />

            <p className="mt-3 line-clamp-3 text-sm text-[#444444]">{product.description}</p>

            {product.details.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[#444444]">
                {product.details.slice(0, 3).map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-[#444444]">
              <span className="flex items-center gap-1.5">
                <Truck className="size-3.5 text-green-700" />
                {getDeliveryEstimate()}
              </span>
              {product.sellerName && (
                <span className="flex items-center gap-1.5">
                  <Store className="size-3.5 text-green-700" />
                  Sold by {product.sellerName}
                </span>
              )}
            </div>

            <ProductCardActions product={product} />

            <div className="mt-3 flex items-center justify-between text-sm">
              <button
                onClick={() => toggleWishlist(product)}
                className="flex items-center gap-1.5 font-medium text-[#444444] hover:text-red-600"
              >
                <Heart className={cn("size-4", wishlisted ? "fill-red-500 text-red-500" : "")} />
                {wishlisted ? "Wishlisted" : "Add to Wishlist"}
              </button>
              <Link href={`/products/${product.id}`} className="font-medium text-green-700 hover:underline">
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
