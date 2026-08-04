import Link from "next/link"
import type { Category } from "@/lib/products"

/** A dense, horizontally-scrolling text pill bar — navigational shortcuts to
 * each real category page, plus "All" (home) and "Offers"/"New" anchors into
 * this same page's Today's Deals / New Arrivals sections. Renders nothing
 * when there are no real categories. */
export function CategoryPillBar({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <nav aria-label="Categories" className="border-b border-border bg-white px-3 py-2 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Pill href="/">All</Pill>
        {categories.map((c) => (
          <Pill key={c.slug} href={`/categories/${c.slug}`}>
            {c.name}
          </Pill>
        ))}
        <Pill href="#todays-deals">Offers</Pill>
        <Pill href="#new-arrivals">New</Pill>
      </div>
    </nav>
  )
}

function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
    >
      {children}
    </Link>
  )
}
