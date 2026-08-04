import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCategoryCatalog, getProductCatalog } from "@/services/catalog.service"

// See app/products/page.tsx for why this is needed — without it, a build's
// static HTML never picks up newly-approved products.
export const revalidate = 60

export const metadata: Metadata = {
  title: "Categories | YashWorld",
  description: "Explore all shopping categories at YashWorld.",
}

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([getCategoryCatalog(), getProductCatalog()])

  return (
    <main className="bg-white min-h-screen">
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="text-center">
          <p className="text-green-600 font-semibold uppercase tracking-[0.25em]">
            Shop by Category
          </p>

          <h1 className="mt-4 text-5xl font-bold text-gray-900">
            Explore Categories
          </h1>

          <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
            Discover everything you need in one place. Browse your favourite
            categories and start shopping today.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => {
            const count = products.filter((p) => p.category === category.slug).length

            return (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-xl transition duration-300 hover:-translate-y-2"
              >
                <div className="relative h-60 overflow-hidden bg-gray-100">
                  <Image
                    src={category.image || "/placeholder.svg"}
                    alt={category.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-110"
                  />
                </div>

                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {category.name}
                  </h2>

                  <p className="mt-2 text-gray-500">
                    {category.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-green-600 font-semibold">
                      {count} Products
                    </span>

                    <span className="flex items-center gap-2 text-green-600 font-semibold">
                      Explore
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}