"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Image as ImageIcon, Plus, Pencil, Trash2 } from "lucide-react"
import { fetchBanners, createBanner, updateBanner, deleteBanner } from "@/lib/admin-banners-client"
import { uploadBannerImage } from "@/services/storage.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { sanitizeDigits } from "@/lib/numeric-input"
import type { Banner } from "@/types/banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const emptyForm = {
  imageUrl: "",
  linkUrl: "",
  title: "",
  startAt: "",
  endAt: "",
  order: "0",
  active: true,
}

export default function AdminBannersPage() {
  const admin = useAdminAuth()
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function refresh() {
    fetchBanners().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setBanners(result.banners)
    })
  }

  useEffect(refresh, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  function openEdit(banner: Banner) {
    setEditingId(banner.id)
    setForm({
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl ?? "",
      title: banner.title ?? "",
      startAt: banner.startAt ? banner.startAt.slice(0, 16) : "",
      endAt: banner.endAt ? banner.endAt.slice(0, 16) : "",
      order: String(banner.order),
      active: banner.active,
    })
    setError("")
    setSheetOpen(true)
  }

  async function handleFileChange(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError("")
    try {
      const url = await uploadBannerImage(admin.uid, file)
      setForm((f) => ({ ...f, imageUrl: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.imageUrl.trim()) {
      setError("Upload an image first.")
      return
    }
    setSaving(true)
    const input = {
      imageUrl: form.imageUrl.trim(),
      ...(form.linkUrl.trim() ? { linkUrl: form.linkUrl.trim() } : {}),
      ...(form.title.trim() ? { title: form.title.trim() } : {}),
      ...(form.startAt ? { startAt: new Date(form.startAt).toISOString() } : {}),
      ...(form.endAt ? { endAt: new Date(form.endAt).toISOString() } : {}),
      order: Number(form.order) || 0,
      active: form.active,
    }
    const result = editingId ? await updateBanner(editingId, input) : await createBanner(input)
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(editingId ? "Banner updated." : "Banner created.")
    setSheetOpen(false)
    refresh()
  }

  async function handleToggleActive(banner: Banner) {
    const result = await updateBanner(banner.id, { active: !banner.active })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(banner.active ? "Banner hidden." : "Banner shown.")
    refresh()
  }

  async function handleDelete(banner: Banner) {
    if (!window.confirm("Delete this banner?")) return
    const result = await deleteBanner(banner.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Banner deleted.")
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ImageIcon className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Banners</h1>
        </div>
        <Button className="h-10" onClick={openCreate}>
          <Plus className="size-4" />
          New Banner
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Promotional banners shown across the storefront, ordered lowest-first.</p>

      <div className="mt-6 flex flex-col gap-3">
        {banners === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {banners && banners.length === 0 && <p className="text-sm text-[#444444]">No banners yet.</p>}
        {banners?.map((banner) => (
          <div key={banner.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner.imageUrl} alt={banner.title ?? "Banner"} className="h-16 w-28 rounded-lg object-cover" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-black">{banner.title || "Untitled"}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${banner.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                    {banner.active ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="text-xs text-[#444444]">
                  Order {banner.order}
                  {banner.startAt ? ` · From ${new Date(banner.startAt).toLocaleDateString()}` : ""}
                  {banner.endAt ? ` · Until ${new Date(banner.endAt).toLocaleDateString()}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-9" onClick={() => handleToggleActive(banner)}>
                {banner.active ? "Hide" : "Show"}
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => openEdit(banner)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="destructive" className="h-9" onClick={() => handleDelete(banner)}>
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{editingId ? "Edit Banner" : "New Banner"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-file">Image</Label>
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
              )}
              <Input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e.target.files?.[0])} />
              {uploading && <p className="text-xs text-[#444444]">Uploading...</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-title">Title (optional)</Label>
              <Input id="banner-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-11" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-link">Link URL (optional)</Label>
              <Input
                id="banner-link"
                value={form.linkUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="/campaigns/flash-sale"
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-start">Start (optional)</Label>
                <Input
                  id="banner-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-end">End (optional)</Label>
                <Input
                  id="banner-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-order">Sort Order</Label>
              <Input
                id="banner-order"
                inputMode="numeric"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: sanitizeDigits(e.target.value) }))}
                className="h-11 w-24"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active (shown on the storefront)
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="mt-2 h-11" onClick={handleSave} disabled={saving || uploading}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Banner"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
