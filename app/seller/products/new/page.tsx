"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getCategoryCatalog } from "@/services/catalog.service"
import { createProduct } from "@/services/product.service"
import { ProductForm, type ProductFormValues } from "@/components/seller/product-form"
import { slugify } from "@/lib/utils"
import type { Category } from "@/lib/products"

export default function NewSellerProductPage() {
  const gate = useSellerGate()
  const router = useRouter()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    getCategoryCatalog().then(setCategories)
  }, [])

  async function handleSubmit(values: ProductFormValues) {
    if (!sellerUid) return
    await createProduct({
      sellerId: sellerUid,
      name: values.name,
      slug: slugify(values.name),
      categoryId: values.categoryId,
      price: values.price,
      originalPrice: values.originalPrice,
      stock: values.stock,
      images: values.images,
      description: values.description,
      plantAttrs: {
        light: values.light,
        wateringFrequencyDays: values.wateringFrequencyDays,
        petSafe: values.petSafe,
        difficulty: values.difficulty,
        size: values.size,
        indoor: values.indoor,
      },
      status: values.status,
    })
    router.push("/seller/products")
  }

  if (gate.state === "loading") {
    return <div className="mx-auto max-w-2xl px-4 py-16">Loading...</div>
  }
  if (gate.state !== "approved") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="mb-4">You need an approved seller account to add products.</p>
        <Link href="/seller/products" className="underline underline-offset-4">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Add Product</h1>
      <div className="mt-8">
        <ProductForm uid={gate.uid} categories={categories} onSubmit={handleSubmit} submitLabel="Create Product" />
      </div>
    </div>
  )
}
