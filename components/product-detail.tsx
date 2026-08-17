"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Truck,
  RotateCcw,
  Leaf,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { useStore } from "@/components/store-provider"
import { type Product } from "@/lib/products"
import { lookupPincode } from "@/lib/checkout-client"
import { sanitizeDigits } from "@/lib/numeric-input"
import { Price, DiscountBadge } from "@/components/price"
import { ProductImage } from "@/components/product-image"
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
import { calculateDiscountPercent } from "@/lib/discount"

// Same threshold app/seller/page.tsx uses for its own low-stock tile — kept
// in sync so a seller and a buyer never see conflicting "low stock" calls.
const LOW_STOCK_THRESHOLD = 5

// Categories whose products actually carry plantAttrs-worth-showing care
// info (light/water/difficulty/pet-safety/indoor). Every seller-listed
// product currently has a plantAttrs block regardless of category (there's
// no per-category schema yet), so this gate is what keeps a pot or a
// gardening tool from showing nonsensical "watering frequency" — not the
// presence of the data itself.
const PLANT_CATEGORY_SLUGS = ["plants", "indoor-plants", "outdoor-plants", "flower-plants", "fruiting-plants"]

export function ProductDetail({ product }: { product: Product }) {
  const router = useRouter()
  const { addToCart, toggleWishlist, isWishlisted, recordProductView } = useStore()
  const [size, setSize] = useState(product.sizes[0])
  const [color, setColor] = useState(product.colors[0])
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const wishlisted = isWishlisted(product.id)
  const discountPercent = calculateDiscountPercent(product.price, product.originalPrice)
  const isPlantCategory = PLANT_CATEGORY_SLUGS.includes(product.category)

  const images = product.images && product.images.length > 0 ? product.images : [product.image]
  const activeImage = images[activeImageIndex] ?? product.image

  const stock = product.stock
  const isOutOfStock = stock !== undefined && stock <= 0
  const isLowStock = stock !== undefined && stock > 0 && stock <= LOW_STOCK_THRESHOLD
  const maxQuantity = stock !== undefined ? Math.max(stock, 0) : undefined

  const [pincode, setPincode] = useState("")
  const [deliveryCheck, setDeliveryCheck] = useState<{
    status: "idle" | "loading" | "success" | "error"
    city?: string
    state?: string
    message?: string
  }>({ status: "idle" })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => recordProductView(product.id), [product.id])

  // Description collapse/expand — descriptionTruncated decides whether the
  // More/Less toggle shows at all (a short description that already fits
  // in 3 lines gets no button). Measured once, while the paragraph is still
  // clamped (scrollHeight > clientHeight only when line-clamp is actually
  // cutting text off) — real layout measurement, not a character-count guess.
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionTruncated, setDescriptionTruncated] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    setDescriptionTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [product.description])

  function goToImage(delta: number) {
    setActiveImageIndex((i) => (i + delta + images.length) % images.length)
  }

  async function handleCheckPincode() {
    if (!/^\d{6}$/.test(pincode)) {
      setDeliveryCheck({ status: "error", message: "Enter a valid 6-digit PIN code." })
      return
    }
    setDeliveryCheck({ status: "loading" })
    const result = await lookupPincode(pincode)
    if (!result.ok) {
      setDeliveryCheck({ status: "error", message: result.error })
      return
    }
    setDeliveryCheck({ status: "success", city: result.result.city, state: result.result.state })
  }

  function handleAddToCart() {
    if (isOutOfStock) return
    addToCart(product, size, color, quantity)
  }

  function handleBuyNow() {
    if (isOutOfStock) return
    addToCart(product, size, color, quantity)
    router.push("/checkout")
  }

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div
            className="relative w-full overflow-hidden rounded-md"
            style={{ aspectRatio: product.galleryAspectRatio ?? 4 / 5 }}
          >
            <ProductImage
              src={activeImage}
              alt={product.name}
              className="absolute inset-0"
              padding="lg"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {product.badge && (
              <Badge
                variant={product.badge === "Sale" ? "destructive" : "default"}
                className="absolute left-4 top-4 rounded-sm"
              >
                {product.badge}
              </Badge>
            )}
            {discountPercent > 0 && (
              <DiscountBadge percent={discountPercent} className="absolute bottom-4 left-4 shadow-sm" />
            )}
            <button
              onClick={() => toggleWishlist(product)}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110"
            >
              <Heart className={cn("size-5", wishlisted ? "fill-red-500 text-red-500" : "text-gray-500")} />
            </button>
            {images.length > 1 && (
              <>
                <button
                  onClick={() => goToImage(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => goToImage(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setActiveImageIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    "relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-white transition",
                    i === activeImageIndex ? "border-foreground" : "border-border hover:border-foreground/50",
                  )}
                >
                  <ProductImage src={url} alt={`${product.name} — image ${i + 1}`} className="absolute inset-0" padding="xs" />
                </button>
              ))}
            </div>
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

          <Price
            price={product.price}
            originalPrice={product.originalPrice}
            size="lg"
            showSavings
            className="mt-5"
          />
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

          {stock !== undefined && (
            <p
              className={cn(
                "mt-3 flex items-center gap-1.5 text-sm font-medium",
                isOutOfStock ? "text-red-600" : isLowStock ? "text-orange-600" : "text-green-700",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  isOutOfStock ? "bg-red-600" : isLowStock ? "bg-orange-500" : "bg-green-600",
                )}
              />
              {isOutOfStock ? "Out of Stock" : isLowStock ? `Only ${stock} left in stock` : "In Stock"}
            </p>
          )}

          <div className="mt-5">
            <p
              ref={descriptionRef}
              className={cn(
                "text-pretty leading-relaxed text-muted-foreground",
                !descriptionExpanded && "line-clamp-3",
              )}
            >
              {product.description}
            </p>
            {descriptionTruncated && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((v) => !v)}
                className="mt-1 flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
              >
                {descriptionExpanded ? "Less" : "More"}
                <ChevronDown className={cn("size-4 transition-transform", descriptionExpanded && "rotate-180")} />
              </button>
            )}
          </div>

          <Separator className="my-6" />

          {/* Deliver to */}
          <div>
            <p className="text-sm font-medium">Deliver to</p>
            <div className="mt-2 flex gap-2">
              <input
                value={pincode}
                onChange={(e) => setPincode(sanitizeDigits(e.target.value, 6))}
                inputMode="numeric"
                placeholder="Enter PIN Code"
                className="h-10 w-36 rounded-sm border border-border px-3 text-sm outline-none focus:border-foreground"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={handleCheckPincode}
                disabled={deliveryCheck.status === "loading"}
              >
                {deliveryCheck.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Check"}
              </Button>
            </div>
            {deliveryCheck.status === "success" && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-green-700">
                <CheckCircle2 className="size-4" />
                Delivering to {deliveryCheck.city}, {deliveryCheck.state}
              </p>
            )}
            {deliveryCheck.status === "error" && (
              <p className="mt-2 text-sm text-destructive">{deliveryCheck.message}</p>
            )}
          </div>

          {/* Quantity */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-sm border border-border">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={isOutOfStock}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center text-sm font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => (maxQuantity !== undefined ? Math.min(maxQuantity, q + 1) : q + 1))}
                disabled={isOutOfStock || (maxQuantity !== undefined && quantity >= maxQuantity)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Benefits — real, existing storefront policy (see the Shipping &
              Returns accordion below), not invented claims. */}
          <div className="mt-6 grid grid-cols-3 gap-2 text-center sm:gap-3">
            <Perk icon={<Truck className="size-5" />} label="Free Delivery" />
            <Perk icon={<RotateCcw className="size-5" />} label="7-Day Return" />
            <Perk icon={<Leaf className="size-5" />} label="Healthy Plant Guarantee" />
          </div>

          <Accordion className="mt-6 w-full">
            <AccordionItem value="description">
              <AccordionTrigger>Description</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </AccordionContent>
            </AccordionItem>
            {isPlantCategory && (
              <AccordionItem value="care-guide">
                <AccordionTrigger>Care Guide</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {product.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="shipping">
              <AccordionTrigger>Shipping &amp; Returns</AccordionTrigger>
              <AccordionContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Return available within 7 days of delivery.</li>
                  <li>Plant must be unused and in original condition.</li>
                  <li>Refund/replacement only after inspection.</li>
                  <li>Damaged or wrong plant can be replaced.</li>
                  <li>No warranty is provided on live plants.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Sticky Add to Cart / Buy Now — mounted only while this component is
          (i.e. only on this product's detail page), so it appears and
          disappears with normal client-side navigation, no extra logic
          needed. z-50 to sit above CompareTray (components/compare-tray.tsx,
          z-40) if both are ever on screen at once. env(safe-area-inset-bottom)
          keeps it clear of the home-indicator area on iPhone/Android. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-8">
          <div className="hidden shrink-0 sm:block">
            <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#16a34a] px-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:max-w-56"
          >
            <ShoppingCart className="size-4 shrink-0" />
            <span className="truncate">Add to Cart</span>
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={isOutOfStock}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:max-w-56"
          >
            <Zap className="size-4 shrink-0" />
            <span className="truncate">{isOutOfStock ? "Out of Stock" : "Buy Now"}</span>
          </button>
        </div>
      </div>
    </>
  )
}

function Perk({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md border border-border p-2 sm:p-3">
      <span className="text-foreground">{icon}</span>
      <span className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</span>
    </div>
  )
}
