import type { Metadata } from "next"
import { ProductListing } from "@/components/product-listing"
import { products } from "@/lib/products"

export const metadata: Metadata = {
  title: "Shop All — YashWorld",
  description: "Browse the full YashWorld collection of premium monochrome essentials.",
}

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          The Collection
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Shop All
        </h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          {products.length} pieces of considered design. Filter by category or sort to find
          your next essential.
        </p>
      </header>
      <ProductListing products={products} />
    </div>
  )
}
