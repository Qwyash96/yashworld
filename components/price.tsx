import { formatPrice } from "@/lib/products"
import { calculateDiscountPercent, calculateSavings } from "@/lib/discount"
import { cn } from "@/lib/utils"

/** Green pill badge — "50% OFF". Same component everywhere a discount
 * percentage is shown, so the style never drifts between pages. */
export function DiscountBadge({ percent, className }: { percent: number; className?: string }) {
  if (percent <= 0) return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700",
        className,
      )}
    >
      {percent}% OFF
    </span>
  )
}

const SIZE_CLASSES = {
  sm: { price: "text-sm font-bold", original: "text-xs", badge: "text-[10px] px-1.5 py-0.5" },
  md: { price: "text-xl font-bold", original: "text-sm", badge: "text-xs px-2 py-0.5" },
  lg: { price: "text-2xl font-bold", original: "text-base", badge: "text-xs px-2.5 py-1" },
} as const

/**
 * The single reusable price display — current price, struck-through
 * original price, and a discount badge, in that order: ₹499  ₹999  50% OFF.
 * The badge (and, with showSavings, the "You Save" line) only render when
 * there's an actual discount (originalPrice set, greater than price, and
 * the computed percent is > 0) — every product-card / product-detail /
 * cart / admin-preview / seller-preview surface in the app renders prices
 * through this one component instead of reimplementing the logic.
 */
export function Price({
  price,
  originalPrice,
  size = "md",
  showSavings = false,
  className,
}: {
  price: number
  originalPrice?: number
  size?: "sm" | "md" | "lg"
  /** Adds a "You Save ₹500 (50% OFF)" line below the price row — used on the product detail page. */
  showSavings?: boolean
  className?: string
}) {
  const discountPercent = calculateDiscountPercent(price, originalPrice)
  const hasDiscount = discountPercent > 0
  const classes = SIZE_CLASSES[size]

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(classes.price, "text-black")}>{formatPrice(price)}</span>
        {hasDiscount && (
          <>
            <span className={cn(classes.original, "text-gray-500 line-through")}>
              {formatPrice(originalPrice!)}
            </span>
            <DiscountBadge percent={discountPercent} className={classes.badge} />
          </>
        )}
      </div>
      {showSavings && hasDiscount && (
        <p className="mt-1 text-sm font-medium text-green-700">
          You Save {formatPrice(calculateSavings(price, originalPrice))} ({discountPercent}% OFF)
        </p>
      )}
    </div>
  )
}
