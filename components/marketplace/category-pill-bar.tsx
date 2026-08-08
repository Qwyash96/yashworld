"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Category } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Desktop/tablet (sm and up): the original dense, horizontally-scrolling
 * text pill bar — untouched. Mobile (below sm): a wrapped grid instead of a
 * single scrolling row, since 9 items at the old compact size read as
 * cramped, tiny-text, and easy to over-scroll on a phone. Both render the
 * same links — "All" (home) plus every real category, plus "Offers"/"New"
 * anchors into this same page's Today's Deals / New Arrivals sections.
 * Renders nothing when there are no real categories. */
export function CategoryPillBar({ categories }: { categories: Category[] }) {
  const pathname = usePathname()
  if (categories.length === 0) return null

  const items: { href: string; label: string }[] = [
    { href: "/", label: "All" },
    ...categories.map((c) => ({ href: `/categories/${c.slug}`, label: c.name })),
    { href: "#todays-deals", label: "Offers" },
    { href: "#new-arrivals", label: "New" },
  ]

  return (
    <nav aria-label="Categories" className="border-b border-border bg-white">
      {/* Mobile only — a fixed 3-column grid, which for these 9 items is
          exactly 3 rows, guaranteed, regardless of how long any one label
          is (unlike flex-wrap, whose row count depends on content width and
          isn't predictable/boundable). A long label wraps to a second line
          within its own cell rather than pushing a 4th row. */}
      <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:hidden">
        {items.map((item) => (
          <MobilePill key={item.href} href={item.href} active={pathname === item.href}>
            {item.label}
          </MobilePill>
        ))}
      </div>

      {/* Desktop/tablet — original compact scrolling row, unchanged. */}
      <div className="hidden px-6 py-2 sm:block lg:px-8">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <Pill key={item.href} href={item.href}>
              {item.label}
            </Pill>
          ))}
        </div>
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

function MobilePill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-[15px] font-semibold leading-tight transition-colors active:scale-95",
        active
          ? "border-green-600 bg-green-600 text-white"
          : "border-border bg-white text-black hover:border-green-600 hover:text-green-700",
      )}
    >
      {children}
    </Link>
  )
}
