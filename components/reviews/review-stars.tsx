"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = { sm: "size-3.5", md: "size-4", lg: "size-6" } as const

/** Readonly star display — rounds `rating` to the nearest whole star. */
export function ReviewStars({
  rating,
  size = "md",
  className,
}: {
  rating: number
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  const rounded = Math.round(rating)
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(SIZE_CLASSES[size], n <= rounded ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300")}
        />
      ))}
    </div>
  )
}

/** Interactive 1-5 star picker — used by the write/edit review form. */
export function ReviewStarsInput({
  value,
  onChange,
  size = "lg",
}: {
  value: number
  onChange: (rating: number) => void
  size?: keyof typeof SIZE_CLASSES
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={cn(SIZE_CLASSES[size], n <= value ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300")}
          />
        </button>
      ))}
    </div>
  )
}
