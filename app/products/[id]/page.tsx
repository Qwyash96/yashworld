import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { ProductDetail } from "@/components/product-detail"
import { ProductCard } from "@/components/product-card"
import { ReviewsSection } from "@/components/reviews/reviews-section"
import { getProductCatalog } from "@/services/catalog.service"

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
  const products = await getProductCatalog()
  const product = products.find((p) => p.id === id)
  if (!product) notFound()

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/categories/${product.category}`} className="capitalize hover:text-foreground">
          {product.category}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <ProductDetail product={product} />

      <ReviewsSection productId={product.id} sellerId={product.sellerId} />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
