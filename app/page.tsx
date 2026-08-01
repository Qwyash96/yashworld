import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { categories, products } from "@/lib/products"

export default function HomePage() {
  const newArrivals = products.filter((p) => p.badge === "New").slice(0, 4)
  const bestsellers = products.slice(0, 8)
  const featuredCategories = categories.slice(0, 3)

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative">
        <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden bg-muted">
          <Image
            src="/images/hero.png"
            alt="YashWorld premium monochrome collection"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/20 to-transparent" />
          <div className="absolute inset-0 mx-auto flex max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Autumn / Winter
              </p>
              <h1 className="mt-4 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Monochrome, refined.
              </h1>
              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                A premium wardrobe stripped to its essentials. Timeless black and white
                pieces made from honest materials.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="h-11 px-6" render={<Link href="/products" />}>
                  Shop the Collection
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6"
                  render={<Link href="/categories" />}
                >
                  Browse Categories
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Shop by Category</h2>
            <p className="mt-2 text-sm text-muted-foreground">Curated edits across the house.</p>
          </div>
          <Link
            href="/categories"
            className="hidden items-center gap-1 text-sm font-medium hover:underline sm:inline-flex"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {featuredCategories.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-md bg-muted"
            >
              <Image
                src={c.image || "/placeholder.svg"}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="font-serif text-2xl font-semibold">{c.name}</h3>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium">
                  Shop now <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">New Arrivals</h2>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Editorial banner */}
      <section className="bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-background/60">
              The Philosophy
            </p>
            <h2 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight">
              Less noise. More substance.
            </h2>
            <p className="mt-4 max-w-md text-pretty leading-relaxed text-background/70">
              Every YashWorld piece is designed to be worn for years, not seasons. We work
              with responsible mills and small workshops to make fewer, better things.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 h-11 px-6"
              render={<Link href="/products" />}
            >
              Explore the Collection
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat value="12" label="Core Pieces" />
            <Stat value="100%" label="Honest Materials" />
            <Stat value="30d" label="Free Returns" />
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">Bestsellers</h2>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Shop all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {bestsellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-background/20 pt-4">
      <p className="font-serif text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-background/60">{label}</p>
    </div>
  )
}
