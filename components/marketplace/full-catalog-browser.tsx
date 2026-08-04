"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { PackageSearch, ChevronDown, Sprout } from "lucide-react"
import { fetchApprovedProducts } from "@/services/catalog.service"
import { type Product, type Category } from "@/lib/products"
import { ProductCard } from "@/components/product-card"
import { ProductCardSkeleton } from "@/components/marketplace/product-card-skeleton"
import { cn } from "@/lib/utils"

const quickFilterExtras = [{ key: "on-sale", label: "On Sale" }]

type SortKey = "relevance" | "latest" | "price-low" | "price-high" | "rating" | "popular"

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "latest", label: "Latest" },
  { key: "price-low", label: "Price Low to High" },
  { key: "price-high", label: "Price High to Low" },
  { key: "rating", label: "Highest Rated" },
  { key: "popular", label: "Most Popular" },
]

const PAGE_SIZE = 12

/** The full, filterable/sortable product catalog — this is app/page.tsx's
 * original body, extracted so the new homepage can layer real marketing
 * sections (hero/deals/featured sellers/etc.) above it without touching its
 * behavior. `categories` now comes from the real Firestore collection
 * (passed down from the server-rendered parent) instead of the hardcoded
 * lib/products.ts array. */
export function FullCatalogBrowser({ categories }: { categories: Category[] }) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("relevance")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const quickFilters = useMemo(
    () => [{ key: "all", label: "All" }, ...categories.map((c) => ({ key: c.slug, label: c.name })), ...quickFilterExtras],
    [categories],
  )

  useEffect(() => {
    let cancelled = false
    function refresh() {
      fetchApprovedProducts().then((result) => {
        if (cancelled) return
        setProducts(result)
        setLoading(false)
      })
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const filtered = useMemo(() => {
    let list = [...products]

    if (activeFilter === "on-sale") {
      list = list.filter((p) => p.originalPrice && p.originalPrice > p.price)
    } else if (activeFilter !== "all") {
      list = list.filter((p) => p.category === activeFilter)
    }

    switch (sortKey) {
      case "latest":
        list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        break
      case "price-low":
        list.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        list.sort((a, b) => b.price - a.price)
        break
      case "rating":
        list.sort((a, b) => b.rating - a.rating)
        break
      case "popular":
        list.sort((a, b) => b.reviews - a.reviews)
        break
      default:
        break
    }

    return list
  }, [products, activeFilter, sortKey])

  function handleLoadMore() {
    setLoadingMore(true)
    window.setTimeout(() => {
      setVisibleCount((c) => c + PAGE_SIZE)
      setLoadingMore(false)
    }, 350)
  }

  const visibleProducts = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div id="browse-all">
      {/* Quick Filters */}
      <section className="border-b border-t border-border bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {quickFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => {
                setActiveFilter(filter.key)
                setVisibleCount(PAGE_SIZE)
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                activeFilter === filter.key
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-border bg-white text-black hover:border-green-600 hover:text-green-700"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* Sort Bar */}
      <section className="border-b border-border px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#444444]">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setSortKey(option.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  sortKey === option.key
                    ? "bg-green-100 text-green-800"
                    : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace Product Grid */}
      <section className="bg-[#fafbfa] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-green-200 bg-white py-20 text-center shadow-sm">
              <div className="flex size-16 items-center justify-center rounded-full bg-green-50">
                <PackageSearch className="size-8 text-green-700" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-black">
                {activeFilter === "all" ? "No products yet" : "No products match this filter"}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-[#444444]">
                {activeFilter === "all"
                  ? "Approved seller products will appear here automatically as sellers list them — nothing is hardcoded on this page."
                  : "Try a different category or clear your filters to see everything available."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {activeFilter !== "all" && (
                  <button
                    onClick={() => {
                      setActiveFilter("all")
                      setVisibleCount(PAGE_SIZE)
                    }}
                    className="rounded-xl border border-green-600 px-6 py-2.5 font-semibold text-green-700 transition hover:bg-green-50"
                  >
                    Clear Filter
                  </button>
                )}
                <Link
                  href="/categories"
                  className="flex items-center gap-1.5 rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white transition hover:bg-green-700"
                >
                  <Sprout className="size-4" />
                  Browse Categories
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
                {loadingMore &&
                  Array.from({ length: Math.min(PAGE_SIZE, filtered.length - visibleProducts.length) }).map(
                    (_, i) => <ProductCardSkeleton key={`more-${i}`} />
                  )}
              </div>

              {hasMore && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <p className="text-xs text-[#444444]">
                    Showing {visibleProducts.length} of {filtered.length} products
                  </p>
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-xl border border-green-600 px-8 py-3 font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <ChevronDown className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
