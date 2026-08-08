"use client"

import Link from "next/link"
import { Star, X, GitCompareArrows } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { Price } from "@/components/price"
import { getDeliveryEstimate } from "@/lib/delivery-estimate"
import { Button } from "@/components/ui/button"
import { ProductImage } from "@/components/product-image"

export default function ComparePage() {
  const { compare, getProductById, toggleCompare, clearCompare } = useStore()
  const products = compare.map((id) => getProductById(id)).filter((p): p is NonNullable<typeof p> => !!p)

  if (products.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <GitCompareArrows className="size-10 text-green-700" />
        <h1 className="mt-4 text-2xl font-bold text-black">Nothing to compare yet</h1>
        <p className="mt-2 text-sm text-[#444444]">
          Tap the compare icon on any product card to add it here — compare up to 4 products side by side.
        </p>
        <Link href="/" className="mt-6 rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700">
          Browse Products
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-black">Compare Products</h1>
        <Button variant="outline" className="h-9" onClick={clearCompare}>
          Clear All
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[640px] gap-4" style={{ gridTemplateColumns: `160px repeat(${products.length}, 1fr)` }}>
          <div />
          {products.map((product) => (
            <div key={product.id} className="relative rounded-2xl border border-border bg-white p-4 shadow-sm">
              <button
                onClick={() => toggleCompare(product)}
                aria-label={`Remove ${product.name}`}
                className="absolute right-2 top-2 rounded-full bg-white p-1 shadow"
              >
                <X className="size-4 text-[#444444]" />
              </button>
              <Link href={`/products/${product.id}`} className="block">
                <div className="relative aspect-square overflow-hidden rounded-xl">
                  <ProductImage src={product.image} alt={product.name} className="absolute inset-0" padding="md" />
                </div>
                <p className="mt-3 line-clamp-2 font-semibold text-black">{product.name}</p>
              </Link>
            </div>
          ))}

          <CompareRow label="Price">
            {products.map((p) => (
              <Price key={p.id} price={p.price} originalPrice={p.originalPrice} size="sm" />
            ))}
          </CompareRow>

          <CompareRow label="Category">
            {products.map((p) => (
              <span key={p.id} className="text-sm text-black">
                {p.category}
              </span>
            ))}
          </CompareRow>

          <CompareRow label="Rating">
            {products.map((p) => (
              <span key={p.id} className="flex items-center gap-1 text-sm text-black">
                <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                {p.rating} ({p.reviews})
              </span>
            ))}
          </CompareRow>

          <CompareRow label="Delivery">
            {products.map((p) => (
              <span key={p.id} className="text-sm text-black">
                {getDeliveryEstimate()}
              </span>
            ))}
          </CompareRow>

          <CompareRow label="Details" align="start">
            {products.map((p) => (
              <ul key={p.id} className="list-inside list-disc space-y-1 text-xs text-[#444444]">
                {p.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ))}
          </CompareRow>
        </div>
      </div>
    </div>
  )
}

function CompareRow({
  label,
  align = "center",
  children,
}: {
  label: string
  align?: "center" | "start"
  children: React.ReactNode
}) {
  return (
    <>
      <div className="flex items-center border-t border-border py-3 text-xs font-semibold uppercase tracking-widest text-[#444444]">
        {label}
      </div>
      {Array.isArray(children) &&
        children.map((child, i) => (
          <div key={i} className={`flex border-t border-border py-3 ${align === "center" ? "items-center" : "items-start"}`}>
            {child}
          </div>
        ))}
    </>
  )
}
