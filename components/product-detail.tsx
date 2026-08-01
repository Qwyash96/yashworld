"use client"

import Image from "next/image"
import { useState } from "react"
import { Heart, Minus, Plus, Star, Truck, RotateCcw, ShieldCheck } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { formatPrice, type Product } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore()
  const [size, setSize] = useState(product.sizes[0])
  const [color, setColor] = useState(product.colors[0])
  const [quantity, setQuantity] = useState(1)
  const wishlisted = isWishlisted(product.id)

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        {product.badge && (
          <Badge
            variant={product.badge === "Sale" ? "destructive" : "default"}
            className="absolute left-4 top-4 rounded-sm"
          >
            {product.badge}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {product.category}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {product.name}
        </h1>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-4",
                  i < Math.round(product.rating)
                    ? "fill-foreground text-foreground"
                    : "text-muted-foreground/40",
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating.toFixed(1)} ({product.reviews} reviews)
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-2xl font-semibold">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-base text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <Separator className="my-6" />

        {/* Color */}
        <div>
          <p className="text-sm font-medium">
            Color: <span className="text-muted-foreground">{color}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "rounded-sm border px-4 py-2 text-sm transition-colors",
                  color === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="mt-5">
          <p className="text-sm font-medium">
            Size: <span className="text-muted-foreground">{size}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={cn(
                  "min-w-12 rounded-sm border px-3 py-2 text-sm transition-colors",
                  size === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity + actions */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-sm border border-border">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center text-sm font-medium">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            size="lg"
            className="h-12 flex-1"
            onClick={() => addToCart(product, size, color, quantity)}
          >
            Add to Bag — {formatPrice(product.price * quantity)}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-12 p-0"
            aria-label="Add to wishlist"
            onClick={() => toggleWishlist(product)}
          >
            <Heart className={cn("size-5", wishlisted && "fill-foreground")} />
          </Button>
        </div>

        {/* Perks */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Perk icon={<Truck className="size-5" />} label="Free shipping" />
          <Perk icon={<RotateCcw className="size-5" />} label="30-day returns" />
          <Perk icon={<ShieldCheck className="size-5" />} label="2-year warranty" />
        </div>

        <Accordion className="mt-6 w-full">
          <AccordionItem value="details">
            <AccordionTrigger>Product Details</AccordionTrigger>
            <AccordionContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="shipping">
            <AccordionTrigger>Shipping &amp; Returns</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">
                Complimentary carbon-neutral shipping on all orders. Returns accepted within
                30 days of delivery in original condition.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

function Perk({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border p-3">
      <span className="text-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
