import type { Metadata } from "next"
import { SearchBar } from "@/components/search-bar"
import { SearchResults } from "@/components/search-results"
import { getProductCatalog } from "@/services/catalog.service"

export const metadata: Metadata = {
  title: "Search — YashWorld",
  description: "Search the YashWorld collection.",
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q = "", category = "" } = await searchParams
  const query = q.trim()
  const products = await getProductCatalog()

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

      <SearchResults query={query} category={category} serverProducts={products} />
    </div>
  )
}
