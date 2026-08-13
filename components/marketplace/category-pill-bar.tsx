"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Category } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Desktop/tablet (sm and up): the original dense, horizontally-scrolling
 * text pill bar — untouched. Mobile (below sm): also one horizontally
 * scrolling row, but with larger rounded pills sized for touch. Both render
 * the same links — "All" (home) plus every real category, plus "Offers"/
 * "New" anchors into this same page's Today's Deals / New Arrivals
 * sections. Renders nothing when there are no real categories. */
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
      {/* Mobile only — one horizontally scrollable row (swipe/scroll), never
          wraps to multiple lines: each pill is shrink-0 + whitespace-nowrap
          and the row itself scrolls with its scrollbar hidden. */}
      <div className="flex gap-2 overflow-x-auto px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
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
        "flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors active:scale-95",
        active
          ? "border-green-600 bg-green-600 text-white"
          : "border-border bg-white text-black hover:border-green-600 hover:text-green-700",
      )}
    >
      {children}
    </Link>
  )
}
