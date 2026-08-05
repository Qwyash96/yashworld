"use client"

import Link from "next/link"
import { X, GitCompareArrows } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { ProductImage } from "@/components/product-image"

/** A floating bottom bar that appears once at least one product is added to
 * compare — mounted globally in components/site-chrome.tsx. */
export function CompareTray() {
  const { compare, catalogItems, toggleCompare, clearCompare } = useCompareItems()

  if (compare.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <GitCompareArrows className="size-5 shrink-0 text-green-700" />
          {catalogItems.map((product) => (
            <div key={product.id} className="relative shrink-0">
              <div className="relative size-12 overflow-hidden rounded-lg border border-border">
                <ProductImage src={product.image} alt={product.name} className="absolute inset-0" padding="xs" />
              </div>
              <button
                onClick={() => toggleCompare(product)}
                aria-label={`Remove ${product.name} from compare`}
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-black text-white"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={clearCompare} className="text-xs font-medium text-[#444444] hover:text-red-600">
            Clear
          </button>
          <Link
            href="/compare"
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Compare ({compare.length})
          </Link>
        </div>
      </div>
    </div>
  )
}

function useCompareItems() {
  const { compare, getProductById, toggleCompare, clearCompare } = useStore()
  const catalogItems = compare.map((id) => getProductById(id)).filter((p): p is NonNullable<typeof p> => !!p)
  return { compare, catalogItems, toggleCompare, clearCompare }
}
