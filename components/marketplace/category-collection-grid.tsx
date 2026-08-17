import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Flower2, Apple, Shovel, Amphora, Leaf, type LucideIcon } from "lucide-react"
import type { Category } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Per-category visual theme, used when the category has no real uploaded
 * image yet (`category.image` is still the default "/placeholder.svg") —
 * a premium gradient + icon treatment instead of a generic gray box. Once
 * an admin uploads a real photo for a category (Admin → Categories), that
 * photo is used automatically and this theme no longer applies to it. */
const CATEGORY_THEME: Record<string, { gradient: string; icon: LucideIcon }> = {
  "flower-plants": { gradient: "from-rose-400 via-pink-500 to-fuchsia-600", icon: Flower2 },
  "fruiting-plants": { gradient: "from-amber-400 via-orange-500 to-red-500", icon: Apple },
  "gardening-tools": { gradient: "from-lime-600 via-green-600 to-emerald-700", icon: Shovel },
  "pots-planters": { gradient: "from-orange-700 via-amber-800 to-stone-800", icon: Amphora },
}
const DEFAULT_THEME = { gradient: "from-green-500 to-emerald-600", icon: Leaf }

/** "Shop by Category" — a fixed 2x2 grid (mobile and desktop alike; this
 * section is always fed exactly 4 curated categories from app/page.tsx) of
 * large, premium cards: dark bottom gradient for text legibility, title,
 * short description, and an "Explore Now" button. Renders nothing when
 * there are no real categories (same empty-state contract as
 * CategoryPillBar). */
export function CategoryCollectionGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg font-bold text-black sm:text-2xl">Shop by Category</h2>
        <p className="text-xs text-[#888888] sm:text-sm">Explore our full range of plants & essentials</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
        {categories.map((category) => {
          const hasRealImage = category.image && category.image !== "/placeholder.svg"
          const theme = CATEGORY_THEME[category.slug] ?? DEFAULT_THEME
          const Icon = theme.icon

          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:aspect-[4/3] sm:rounded-[28px]"
            >
              {hasRealImage ? (
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-br", theme.gradient)}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute size-24 rounded-full bg-white/10 blur-2xl sm:size-40" />
                    <Icon
                      className="relative size-14 text-white/90 transition-transform duration-300 group-hover:scale-110 sm:size-24"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 p-3 sm:gap-1.5 sm:p-5">
                <h3 className="text-base font-bold text-white sm:text-2xl">{category.name}</h3>
                <p className="line-clamp-2 text-[11px] text-white/85 sm:text-sm">{category.description}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-black transition-all duration-200 group-hover:gap-1.5 sm:px-4 sm:py-1.5 sm:text-xs">
                  Explore Now
                  <ArrowRight className="size-3 sm:size-3.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
