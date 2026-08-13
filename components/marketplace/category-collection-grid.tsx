import Link from "next/link"
import Image from "next/image"
import type { Category } from "@/lib/products"

/** "Shop by Category" — large image cards (2 cols mobile, 3 tablet, 4
 * desktop) for every real category (Admin → Categories), each with a dark
 * gradient overlay, the category's own name/description on top, and — when
 * a real count is passed in `productCounts` — how many real products are in
 * it. Renders nothing when there are no real categories (same empty-state
 * contract as CategoryPillBar). */
export function CategoryCollectionGrid({
  categories,
  productCounts,
}: {
  categories: Category[]
  /** slug → count of real, currently-catalogued products in that category. Omit the entry (or the whole prop) to just not show a count for that card — never fabricate a number. */
  productCounts?: Record<string, number>
}) {
  if (categories.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
      <div className="mb-3">
        <h2 className="text-base font-bold text-black sm:text-lg">Shop by Category</h2>
        <p className="text-xs text-[#888888] sm:text-sm">Explore our full range of plants & essentials</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {categories.map((category) => {
          const count = productCounts?.[category.slug]
          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl"
            >
              <Image
                src={category.image || "/placeholder.svg"}
                alt={category.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4">
                <h3 className="text-[13px] font-bold text-white sm:text-lg">{category.name}</h3>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/85 sm:text-sm">{category.description}</p>
                {typeof count === "number" && count > 0 && (
                  <p className="mt-0.5 text-[10px] font-medium text-white/70 sm:text-xs">
                    {count} product{count === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
