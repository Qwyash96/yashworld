"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductImageUploader } from "@/components/seller/product-image-uploader"
import { Price } from "@/components/price"
import { calculateDiscountPercent } from "@/lib/discount"
import { sanitizeDecimal, sanitizeDigits } from "@/lib/numeric-input"
import type { Category } from "@/lib/products"
import type { CareDifficulty, LightRequirement, PlantSize, ProductImage } from "@/types/product"

export type ProductFormValues = {
  name: string
  description: string
  price: number
  originalPrice: number | undefined
  categoryId: string
  stock: number
  images: ProductImage[]
  status: "draft" | "pending"
  light: LightRequirement
  wateringFrequencyDays: number
  difficulty: CareDifficulty
  size: PlantSize
  petSafe: boolean
  indoor: boolean
}

/** Internal editing shape — the four numeric fields are plain strings while
 * the user is typing, so the input can be genuinely blank (not "0") and
 * never round-trips through Number() on every keystroke, which is what
 * causes a value like "05" to appear when typing "5" after a stray zero. */
type ProductFormDraft = Omit<ProductFormValues, "price" | "originalPrice" | "stock" | "wateringFrequencyDays"> & {
  price: string
  originalPrice: string
  stock: string
  wateringFrequencyDays: string
}

const defaultDraft: ProductFormDraft = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  categoryId: "",
  stock: "",
  images: [],
  status: "draft",
  light: "medium",
  wateringFrequencyDays: "",
  difficulty: "easy",
  size: "medium",
  petSafe: false,
  indoor: true,
}

/** Converts incoming numeric initialValues (e.g. an existing product being
 * edited) into the string-based draft shape — blank only when genuinely
 * unset, never a stray "0". */
function toDraft(initialValues?: Partial<ProductFormValues>): ProductFormDraft {
  return {
    ...defaultDraft,
    ...initialValues,
    price: initialValues?.price !== undefined ? String(initialValues.price) : defaultDraft.price,
    originalPrice:
      initialValues?.originalPrice !== undefined ? String(initialValues.originalPrice) : defaultDraft.originalPrice,
    stock: initialValues?.stock !== undefined ? String(initialValues.stock) : defaultDraft.stock,
    wateringFrequencyDays:
      initialValues?.wateringFrequencyDays !== undefined
        ? String(initialValues.wateringFrequencyDays)
        : defaultDraft.wateringFrequencyDays,
  }
}

export function ProductForm({
  uid,
  initialValues,
  categories,
  onSubmit,
  submitLabel,
}: {
  uid: string
  initialValues?: Partial<ProductFormValues>
  categories: Category[]
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel: string
}) {
  const [draft, setDraft] = useState<ProductFormDraft>(() => toDraft(initialValues))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ProductFormDraft>(key: K, value: ProductFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  // Live preview values — recomputed on every render straight from the
  // draft strings, so the discount preview and the "exceeds original price"
  // check update as the seller types, with no extra state to keep in sync.
  const livePrice = Number(draft.price) || 0
  const liveOriginalPrice = draft.originalPrice.trim() ? Number(draft.originalPrice) : undefined
  const priceExceedsOriginal =
    liveOriginalPrice !== undefined && liveOriginalPrice > 0 && livePrice > liveOriginalPrice
  const liveDiscountPercent = calculateDiscountPercent(livePrice, liveOriginalPrice)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const price = Number(draft.price)
    const stock = draft.stock.trim() ? Number(draft.stock) : 0
    const originalPrice = draft.originalPrice.trim() ? Number(draft.originalPrice) : undefined
    // Falls back to the previous default (7) only if left blank — the field
    // itself still starts blank, per "no numeric field is prefilled".
    const wateringFrequencyDays = draft.wateringFrequencyDays.trim() ? Number(draft.wateringFrequencyDays) : 7

    if (!draft.name.trim() || !draft.categoryId || !draft.price.trim() || price <= 0) {
      setError("Please fill in name, category, and a price greater than 0.")
      return
    }
    if (originalPrice !== undefined && price > originalPrice) {
      setError("Selling Price cannot exceed Original Price.")
      return
    }
    if (draft.images.length === 0) {
      setError("Please upload at least one product image.")
      return
    }

    const values: ProductFormValues = {
      name: draft.name,
      description: draft.description,
      price,
      originalPrice,
      categoryId: draft.categoryId,
      stock,
      images: draft.images,
      status: draft.status,
      light: draft.light,
      wateringFrequencyDays,
      difficulty: draft.difficulty,
      size: draft.size,
      petSafe: draft.petSafe,
      indoor: draft.indoor,
    }

    try {
      setSubmitting(true)
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          rows={4}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.price}
            onChange={(e) => set("price", sanitizeDecimal(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="originalPrice">Original Price (optional)</Label>
          <Input
            id="originalPrice"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.originalPrice}
            onChange={(e) => set("originalPrice", sanitizeDecimal(e.target.value))}
          />
        </div>
      </div>

      {priceExceedsOriginal ? (
        <p className="-mt-3 text-sm text-destructive">Selling Price cannot exceed Original Price.</p>
      ) : (
        draft.price.trim() &&
        liveDiscountPercent > 0 && (
          <div className="-mt-3 rounded-xl bg-green-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buyer preview
            </p>
            <Price price={livePrice} originalPrice={liveOriginalPrice} size="sm" />
          </div>
        )
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={draft.categoryId}
            onValueChange={(v) => {
              if (v) set("categoryId", v)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={draft.stock}
            onChange={(e) => set("stock", sanitizeDigits(e.target.value))}
            required
          />
        </div>
      </div>

      <ProductImageUploader uid={uid} value={draft.images} onChange={(images) => set("images", images)} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Light</Label>
          <Select
            value={draft.light}
            onValueChange={(v) => {
              if (v) set("light", v as LightRequirement)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="bright">Bright</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={draft.difficulty}
            onValueChange={(v) => {
              if (v) set("difficulty", v as CareDifficulty)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Size</Label>
          <Select
            value={draft.size}
            onValueChange={(v) => {
              if (v) set("size", v as PlantSize)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wateringFrequencyDays">Water every (days)</Label>
          <Input
            id="wateringFrequencyDays"
            type="text"
            inputMode="numeric"
            placeholder="7"
            value={draft.wateringFrequencyDays}
            onChange={(e) => set("wateringFrequencyDays", sanitizeDigits(e.target.value))}
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.petSafe}
            onChange={(e) => set("petSafe", e.target.checked)}
          />
          Pet safe
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.indoor}
            onChange={(e) => set("indoor", e.target.checked)}
          />
          Indoor plant
        </label>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={draft.status}
          onValueChange={(v) => {
            if (v) set("status", v as "draft" | "pending")
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft (not visible, editable)</SelectItem>
            <SelectItem value="pending">Submit for review</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          An admin must approve a submitted product before it appears in the store.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={submitting || draft.images.length === 0}>
        {submitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  )
}
