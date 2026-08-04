import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { type Product } from "@/lib/products"

/** Shared shell for every homepage product section (Best Sellers, New
 * Arrivals, Recommended) — real products in, real grid out. Renders nothing
 * when there's no real data for this section, rather than padding it out
 * with placeholders. */
export function ProductRail({
  id,
  title,
  subtitle,
  products,
  viewAllHref,
}: {
  id?: string
  title: string
  subtitle?: string
  products: Product[]
  viewAllHref?: string
}) {
  if (products.length === 0) return null

  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-black">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[#444444]">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline">
            View All
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
