"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { formatPrice, type Product } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted, addToCart } = useStore()
  const wishlisted = isWishlisted(product.id)

  return (
    <div className="group relative flex flex-col">
      <Link
        href={`/products/${product.id}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-md bg-muted"
      >
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badge && (
          <Badge
            variant={product.badge === "Sale" ? "destructive" : "default"}
            className="absolute left-3 top-3 rounded-sm"
          >
            {product.badge}
          </Badge>
        )}
      </Link>

      <button
        type="button"
        onClick={() => toggleWishlist(product)}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-colors hover:bg-background"
      >
        <Heart
          className={cn(
            "size-4 transition-colors",
            wishlisted ? "fill-foreground text-foreground" : "text-foreground",
          )}
        />
      </button>

      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {product.category}
        </p>
        <Link
          href={`/products/${product.id}`}
          className="mt-1 text-sm font-medium leading-snug hover:underline"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => addToCart(product, product.sizes[0], product.colors[0])}
          className="mt-3 w-full rounded-sm border border-foreground py-2 text-xs font-medium uppercase tracking-widest opacity-0 transition-opacity hover:bg-foreground hover:text-background focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          Add to Bag
        </button>
      </div>
    </div>
  )
}
