import Link from "next/link"
import Image from "next/image"
import type { Category } from "@/lib/products"

/** Real categories collection (Admin → Catalog → Categories) — driven by
 * whatever an admin has actually created, not a hardcoded list. */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-black">Shop by Category</h2>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-green-600 hover:shadow-md"
          >
            <div className="relative size-16 overflow-hidden rounded-full bg-gray-50">
              <Image src={category.image || "/placeholder.svg"} alt={category.name} fill className="object-cover transition duration-300 group-hover:scale-110" />
            </div>
            <span className="text-sm font-semibold text-black">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
