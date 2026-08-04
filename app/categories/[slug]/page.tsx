import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { ProductListing } from "@/components/product-listing"
import { getCategoryCatalog, getProductCatalog } from "@/services/catalog.service"

// See app/products/page.tsx for why this is needed — without it, this SSG
// route never picks up newly-approved products after the initial build.
export const revalidate = 60

export async function generateStaticParams() {
  const categories = await getCategoryCatalog()
  return categories.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const categories = await getCategoryCatalog()
  const category = categories.find((c) => c.slug === slug)
  if (!category) return { title: "Category — YashWorld" }
  return {
    title: `${category.name} — YashWorld`,
    description: category.description,
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [categories, products] = await Promise.all([getCategoryCatalog(), getProductCatalog()])
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  const items = products.filter((p) => p.category === slug)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/categories" className="hover:text-foreground">
          Categories
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {category.name}
        </h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">{category.description}</p>
      </header>

      <ProductListing products={items} showCategoryFilter={false} />
    </div>
  )
}
