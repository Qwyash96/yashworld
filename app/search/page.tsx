import type { Metadata } from "next"
import Link from "next/link"
import { ProductCard } from "@/components/product-card"
import { SearchBar } from "@/components/search-bar"
import { searchProducts, products } from "@/lib/products"

export const metadata: Metadata = {
  title: "Search — YashWorld",
  description: "Search the YashWorld collection.",
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams
  const query = q.trim()
  const results = query ? searchProducts(query) : []
  const suggestions = products.slice(0, 4)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Search</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Find your next essential across the collection.
        </p>
        <div className="mt-6">
          <SearchBar defaultValue={query} />
        </div>
      </header>

      {query ? (
        results.length > 0 ? (
          <>
            <p className="mb-8 text-sm text-muted-foreground">
              {results.length} {results.length === 1 ? "result" : "results"} for{" "}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-lg font-medium">
              No results for &ldquo;{query}&rdquo;
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another term or{" "}
              <Link href="/products" className="underline underline-offset-4">
                browse all products
              </Link>
              .
            </p>
          </div>
        )
      ) : (
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Popular right now
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
