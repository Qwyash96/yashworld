"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Image as ImageIcon } from "lucide-react"
import { fetchCategoryImages, saveCategoryImage } from "@/lib/admin-category-images-client"
import { uploadCategoryImage } from "@/services/storage.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { SingleImageUploader } from "@/components/media/single-image-uploader"

// The 4 homepage "Shop by Category" cards (see app/page.tsx's
// SHOP_BY_CATEGORY_SLUGS) — fixed on purpose, this page only ever manages
// these exact 4 slugs, not a general category editor (that's Admin →
// Categories).
const CATEGORY_CARDS = [
  { name: "Flower", slug: "flower-plants" },
  { name: "Fruit", slug: "fruiting-plants" },
  { name: "Gardening Tools", slug: "gardening-tools" },
  { name: "Pots", slug: "pots-planters" },
]

/** Admin → Marketing → Category Images — one image per homepage "Shop by
 * Category" card, uploaded through the same Storage pipeline as every other
 * admin image upload (services/storage.service.ts's uploadCategoryImage +
 * SingleImageUploader). Saves the resulting URL to categoryImages/{slug}
 * (app/api/admin/category-images), which app/page.tsx reads and merges into
 * the homepage grid automatically — no code change needed per upload. */
export default function AdminCategoryImagesPage() {
  const admin = useAdminAuth()
  const [images, setImages] = useState<Record<string, string> | null>(null)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)

  function refresh() {
    fetchCategoryImages().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setImages(result.images)
    })
  }

  useEffect(refresh, [])

  async function handleUpload(slug: string, url: string) {
    if (!url) return
    setSavingSlug(slug)
    const result = await saveCategoryImage(slug, url)
    setSavingSlug(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category image updated — live on the homepage now.")
    setImages((prev) => ({ ...(prev ?? {}), [slug]: url }))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <ImageIcon className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Category Images</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        The homepage&apos;s &quot;Shop by Category&quot; cards — Flower, Fruit, Gardening Tools, Pots. Upload an image for each
        and it appears on the homepage automatically, no other change needed.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORY_CARDS.map((category) => (
          <div key={category.slug} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <p className="font-semibold text-black">{category.name}</p>
            <p className="mb-3 text-xs text-[#444444]">{category.slug}</p>

            {images === null ? (
              <p className="text-sm text-[#444444]">Loading...</p>
            ) : (
              <SingleImageUploader
                uid={admin.uid}
                folder="category-images"
                value={images[category.slug] ?? ""}
                onChange={(url) => handleUpload(category.slug, url)}
                uploadFn={uploadCategoryImage}
                label="Category Image"
                aspectClassName="aspect-[4/3]"
              />
            )}

            {savingSlug === category.slug && <p className="mt-2 text-xs text-green-700">Saving...</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
