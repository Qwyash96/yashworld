import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { ProductDetail } from "@/components/product-detail"
import { ProductCard } from "@/components/product-card"
import { ReviewsSection } from "@/components/reviews/reviews-section"
import { getProductCatalog, getCategoryCatalog } from "@/services/catalog.service"

// See app/products/page.tsx for why this is needed on a Firestore-backed page.
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const products = await getProductCatalog()
  const product = products.find((p) => p.id === id)
  if (!product) return { title: "Product — IXOFLORA" }

  const cover = product.image
  const title = `${product.name} — IXOFLORA`
  const description = product.description?.slice(0, 160) || `Buy ${product.name} on IXOFLORA — India's premium plant marketplace.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [products, categories] = await Promise.all([getProductCatalog(), getCategoryCatalog()])
  const product = products.find((p) => p.id === id)
  if (!product) notFound()

  const category = categories.find((c) => c.slug === product.category)

  // Same category first; if that isn't enough to fill the section, top up
  // with any other real product (never the one currently open) rather than
  // showing fewer than 4 cards.
  const otherProducts = products.filter((p) => p.id !== product.id)
  const sameCategory = otherProducts.filter((p) => p.category === product.category)
  const crossCategory = otherProducts.filter((p) => p.category !== product.category)
  const related = [...sameCategory, ...crossCategory].slice(0, 4)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-24 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground sm:mb-5">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/categories/${product.category}`} className="hover:text-foreground">
          {category?.name ?? product.category}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <ProductDetail product={product} />

      <ReviewsSection productId={product.id} sellerId={product.sellerId} />

      {related.length > 0 && (
        <section className="mt-10 sm:mt-12">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">You may also like</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
