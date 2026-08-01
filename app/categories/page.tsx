import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { categories, getProductsByCategory } from "@/lib/products"

export const metadata: Metadata = {
  title: "Categories — YashWorld",
  description: "Explore YashWorld categories: apparel, footwear, bags, watches, and accessories.",
}

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Browse
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Categories
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => {
          const count = getProductsByCategory(c.slug).length
          return (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className={`group relative overflow-hidden rounded-md bg-muted ${
                i === 0 ? "sm:col-span-2 sm:aspect-[2/1]" : "aspect-[4/3]"
              }`}
            >
              <Image
                src={c.image || "/placeholder.svg"}
                alt={c.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {count} {count === 1 ? "item" : "items"}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">{c.name}</h2>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
                  Shop {c.name} <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
