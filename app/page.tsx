"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Mic, PackageSearch, ChevronDown, Sprout } from "lucide-react"
import { toast } from "sonner"
import { fetchApprovedProducts } from "@/services/catalog.service"
import { categories, type Product } from "@/lib/products"
import { ProductCard } from "@/components/product-card"
import { ProductCardSkeleton } from "@/components/marketplace/product-card-skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const searchSuggestions = categories.slice(0, 6).map((c) => c.name)

const quickFilters: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  ...categories.map((c) => ({ key: c.slug, label: c.name })),
  { key: "on-sale", label: "On Sale" },
]

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

export default function HomePage() {
  const router = useRouter()
  const [searchCategory, setSearchCategory] = useState("all")
  const [query, setQuery] = useState("")
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("relevance")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

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

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const params = new URLSearchParams({ q: query.trim() })
    if (searchCategory !== "all") params.set("category", searchCategory)
    router.push(`/search?${params.toString()}`)
  }

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
    <div className="bg-white">
      {/* Search Area */}
      <section className="bg-gradient-to-b from-green-50 to-[#f3f5f2] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-center text-3xl font-bold text-black sm:text-4xl">
            What are you looking for today?
          </h1>
          <p className="mt-2 text-center text-sm text-[#444444] sm:text-base">
            Search thousands of plants, pots and gardening essentials from verified sellers.
          </p>

          <form onSubmit={submitSearch} className="relative mt-8">
            <div className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-white shadow-lg transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Select value={searchCategory} onValueChange={(v) => setSearchCategory(v ?? "all")}>
                <SelectTrigger className="h-14 w-32 shrink-0 rounded-none border-0 border-r border-border bg-[#f3f5f2] px-3 text-sm font-medium sm:w-52 sm:px-4">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                placeholder="Search for plants, pots, tools and more..."
                className="h-14 min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-black placeholder:text-[#444444] outline-none sm:px-4"
              />

              <button
                type="button"
                aria-label="Voice search"
                onClick={() => toast.info("Voice search coming soon")}
                className="flex shrink-0 items-center px-3 text-green-700 transition hover:bg-green-50"
              >
                <Mic className="size-5" />
              </button>

              <button
                type="submit"
                aria-label="Search"
                className="flex shrink-0 items-center gap-2 bg-green-600 px-5 font-semibold text-white transition hover:bg-green-700 sm:px-8"
              >
                <Search className="size-5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            {suggestionsOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-white p-3 shadow-xl">
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-[#444444]">
                  Popular searches
                </p>
                <div className="flex flex-wrap gap-2 px-2">
                  {searchSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => setQuery(s)}
                      className="rounded-full bg-[#f3f5f2] px-3 py-1.5 text-sm text-black transition hover:bg-green-50 hover:text-green-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Quick Filters */}
      <section className="border-b border-border bg-white px-4 py-5 sm:px-6 lg:px-8">
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
