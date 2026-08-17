import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { type Product } from "@/lib/products"

/** Shared shell for every homepage product section — real products in, a
 * dense Flipkart-style grid out: 2 cols on mobile, 3 on tablet, 4 on
 * desktop (matches the redesigned ProductCard, which has no inline buttons
 * — see components/product-card.tsx). Renders nothing when there's no real
 * data for this section, rather than padding it out with placeholders. */
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
    <section id={id} className="mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-black sm:text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-[#888888] sm:text-sm">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="flex items-center gap-0.5 text-xs font-semibold text-green-700 hover:underline sm:text-sm">
            View All
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
