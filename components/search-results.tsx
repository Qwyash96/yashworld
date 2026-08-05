"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/products"

export function SearchResults({
  query,
  category = "",
  serverProducts,
}: {
  query: string
  category?: string
  serverProducts: Product[]
}) {
  const results = useMemo(() => {
    if (!query) return []
    const search = query.toLowerCase()
    return serverProducts.filter((product) => {
      if (category && product.category !== category) return false
      return (
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search)
      )
    })
  }, [serverProducts, query, category])

  const suggestions = serverProducts.slice(0, 4)

  if (!query) {
    return (
      <div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Popular right now
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-6">
          {suggestions.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">No results for &ldquo;{query}&rdquo;</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try another term or{" "}
          <Link href="/products" className="underline underline-offset-4">
            browse all products
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="mb-8 text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? "result" : "results"} for{" "}
        <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-6">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  )
}
