"use client"

import { useEffect, useState } from "react"
import { getPendingProducts, approveProduct, rejectProduct } from "@/services/product.service"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function AdminProductModerationPage() {
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    getPendingProducts().then(setProducts)
  }, [])

  async function handleApprove(id: string) {
    await approveProduct(id)
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  async function handleReject(id: string) {
    await rejectProduct(id)
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Product Moderation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Products awaiting review before they appear in the store.
      </p>

      {products === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No products pending review.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  ₹{product.price} · Seller {product.sellerId}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{product.status}</Badge>
                <Button size="sm" onClick={() => handleApprove(product.id)}>
                  Approve
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleReject(product.id)}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
