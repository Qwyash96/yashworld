"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { formatPrice } from "@/lib/products"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function CartPage() {
  const router = useRouter()
  const { cart, cartSubtotal, updateQuantity, removeFromCart, clearCart, getProductById } =
    useStore()

  const shipping = cartSubtotal > 250 || cartSubtotal === 0 ? 0 : 15
  const total = cartSubtotal + shipping

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-7" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">Your bag is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Discover premium plants, pots and gardening essentials.
        </p>
        <Button size="lg" className="mt-8 h-11 px-6" render={<Link href="/products" />}>
          Continue Shopping
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Your Bag</h1>
        <button
          onClick={clearCart}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="size-4" /> Clear
        </button>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <ul className="lg:col-span-2 divide-y divide-border border-y border-border">
          {cart.map((item) => {
            const product = getProductById(item.id)
            if (!product) return null
            return (
              <li key={`${item.id}-${item.size}-${item.color}`} className="flex gap-4 py-5">
                <Link
                  href={`/products/${product.id}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted sm:size-28"
                >
                  <Image
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium leading-snug hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                        {item.color} · {item.size}
                      </p>
                    </div>
                    <button
                      aria-label="Remove item"
                      onClick={() => removeFromCart(item.id, item.size, item.color)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-sm border border-border">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          updateQuantity(item.id, item.size, item.color, item.quantity - 1)
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Increase quantity"
                        onClick={() =>
                          updateQuantity(item.id, item.size, item.color, item.quantity + 1)
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <Price
                      price={product.price * item.quantity}
                      originalPrice={
                        product.originalPrice ? product.originalPrice * item.quantity : undefined
                      }
                      size="sm"
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="rounded-md border border-border p-6">
            <h2 className="font-medium">Order Summary</h2>
            <Separator className="my-4" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatPrice(cartSubtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-medium">
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </dd>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {formatPrice(250 - cartSubtotal)} more for free shipping.
                </p>
              )}
            </dl>
            <Separator className="my-4" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Button
              size="lg"
              className="mt-6 h-12 w-full"
              onClick={() => router.push("/checkout")}
            >
              Checkout
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              render={<Link href="/products" />}
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
