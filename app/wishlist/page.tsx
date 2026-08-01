"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { ProductCard } from "@/components/product-card"
import { getProduct } from "@/lib/products"
import { Button } from "@/components/ui/button"

export default function WishlistPage() {
  const { wishlist } = useStore()
  const items = wishlist.map((id) => getProduct(id)).filter((p) => p !== undefined)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Saved
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Wishlist
        </h1>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Heart className="size-7" />
          </div>
          <h2 className="mt-6 text-lg font-medium">Your wishlist is empty</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Tap the heart on any product to save it here for later.
          </p>
          <Button size="lg" className="mt-8 h-11 px-6" render={<Link href="/products" />}>
            Explore Products
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
