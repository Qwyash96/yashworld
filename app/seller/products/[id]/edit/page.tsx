"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getCategoryCatalog } from "@/services/catalog.service"
import { getProductById, updateProduct } from "@/services/product.service"
import { ProductForm, type ProductFormValues } from "@/components/seller/product-form"
import type { Category } from "@/lib/products"
import type { Product } from "@/types/product"

export default function EditSellerProductPage() {
  const gate = useSellerGate()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [categories, setCategories] = useState<Category[]>([])
  const [product, setProduct] = useState<Product | null | "loading">("loading")

  useEffect(() => {
    getCategoryCatalog().then(setCategories)
  }, [])

  useEffect(() => {
    getProductById(params.id).then((p) => setProduct(p))
  }, [params.id])

  async function handleSubmit(values: ProductFormValues) {
    await updateProduct(params.id, {
      name: values.name,
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

  if (gate.state === "loading" || product === "loading") {
    return <div className="mx-auto max-w-2xl px-4 py-16">Loading...</div>
  }
  if (gate.state !== "approved") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        You need an approved seller account to edit products.
      </div>
    )
  }
  if (!product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="mb-4">Product not found.</p>
        <Link href="/seller/products" className="underline underline-offset-4">
          Back
        </Link>
      </div>
    )
  }
  if (product.sellerId !== sellerUid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        You don&apos;t have permission to edit this product.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-lg font-bold tracking-tight sm:text-xl">Edit Product</h1>
      {product.status === "approved" && (
        <p className="mt-3 text-sm text-muted-foreground">
          This product is live. Saving changes will resubmit it for admin review.
        </p>
      )}
      {product.status === "rejected" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {product.rejectionReason
            ? `This product was rejected: ${product.rejectionReason}`
            : "This product was rejected."}{" "}
          Saving changes will resubmit it for admin review.
        </p>
      )}
      <div className="mt-4 sm:mt-8">
        <ProductForm
          uid={gate.uid}
          categories={categories}
          initialValues={{
            name: product.name,
            description: product.description,
            price: product.price,
            originalPrice: product.originalPrice,
            categoryId: product.categoryId,
            stock: product.stock,
            images: product.images,
            status:
              product.status === "approved" || product.status === "rejected" ? "pending" : product.status,
            light: product.plantAttrs.light,
            wateringFrequencyDays: product.plantAttrs.wateringFrequencyDays,
            difficulty: product.plantAttrs.difficulty,
            size: product.plantAttrs.size,
            petSafe: product.plantAttrs.petSafe,
            indoor: product.plantAttrs.indoor,
          }}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  )
}
