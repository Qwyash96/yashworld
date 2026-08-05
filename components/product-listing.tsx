"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { categories, type Product } from "@/lib/products"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type SortKey = "featured" | "price-asc" | "price-desc" | "rating"

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
]

export function ProductListing({
  products,
  showCategoryFilter = true,
}: {
  products: Product[]
  showCategoryFilter?: boolean
}) {
  const [sort, setSort] = useState<SortKey>("featured")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const available = useMemo(() => {
    const set = new Set(products.map((p) => p.category))
    return categories.filter((c) => set.has(c.slug))
  }, [products])

  const filtered = useMemo(() => {
    let list = products
    if (showCategoryFilter && activeCategory !== "all") {
      list = list.filter((p) => p.category === activeCategory)
    }
    const sorted = [...list]
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price)
        break
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price)
        break
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating)
        break
    }
    return sorted
  }, [products, activeCategory, sort, showCategoryFilter])

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        {showCategoryFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
                activeCategory === "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground",
              )}
            >
              All
            </button>
            {available.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCategory(c.slug)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
                  activeCategory === c.slug
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-lg font-medium">No products found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different category or sort option.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
