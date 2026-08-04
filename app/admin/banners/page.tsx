"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Image as ImageIcon, Plus, Pencil, Trash2, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { fetchBanners, createBanner, updateBanner, deleteBanner } from "@/lib/admin-banners-client"
import { uploadBannerImage } from "@/services/storage.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchApprovedProducts } from "@/services/catalog.service"
import { SingleImageUploader } from "@/components/media/single-image-uploader"
import type { Banner } from "@/types/banner"
import type { Product } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const emptyForm = {
  imageUrl: "",
  linkUrl: "",
  title: "",
  subtitle: "",
  buttonText: "",
  productId: "",
  startAt: "",
  endAt: "",
  active: true,
}

function SortableBannerRow({
  banner,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  banner: Banner
  onToggleActive: (banner: Banner) => void
  onEdit: (banner: Banner) => void
  onDelete: (banner: Banner) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted-foreground hover:text-black active:cursor-grabbing"
        >
          <GripVertical className="size-5" />
        </button>
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
            {banner.subtitle ? `${banner.subtitle} · ` : ""}
            {banner.startAt ? `From ${new Date(banner.startAt).toLocaleDateString()}` : ""}
            {banner.endAt ? ` · Until ${new Date(banner.endAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-9" onClick={() => onToggleActive(banner)}>
          {banner.active ? "Hide" : "Show"}
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={() => onEdit(banner)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" className="h-9" onClick={() => onDelete(banner)}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  )
}

export default function AdminBannersPage() {
  const admin = useAdminAuth()
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function refresh() {
    fetchBanners().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setBanners(result.banners)
    })
  }

  useEffect(() => {
    refresh()
    fetchApprovedProducts().then(setProducts)
  }, [])

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
      subtitle: banner.subtitle ?? "",
      buttonText: banner.buttonText ?? "",
      productId: banner.productId ?? "",
      startAt: banner.startAt ? banner.startAt.slice(0, 16) : "",
      endAt: banner.endAt ? banner.endAt.slice(0, 16) : "",
      active: banner.active,
    })
    setError("")
    setSheetOpen(true)
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
      ...(form.subtitle.trim() ? { subtitle: form.subtitle.trim() } : {}),
      ...(form.buttonText.trim() ? { buttonText: form.buttonText.trim() } : {}),
      ...(form.productId ? { productId: form.productId } : {}),
      ...(form.startAt ? { startAt: new Date(form.startAt).toISOString() } : {}),
      ...(form.endAt ? { endAt: new Date(form.endAt).toISOString() } : {}),
      active: form.active,
      ...(editingId ? {} : { order: banners?.length ?? 0 }),
    }
    const result = editingId ? await updateBanner(editingId, input) : await createBanner(input as Parameters<typeof createBanner>[0])
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!banners || !over || active.id === over.id) return

    const oldIndex = banners.findIndex((b) => b.id === active.id)
    const newIndex = banners.findIndex((b) => b.id === over.id)
    const reordered = arrayMove(banners, oldIndex, newIndex)
    setBanners(reordered)

    setReordering(true)
    await Promise.all(reordered.map((b, index) => (b.order !== index ? updateBanner(b.id, { order: index }) : null)))
    setReordering(false)
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ImageIcon className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Home Banners</h1>
        </div>
        <Button className="h-10" onClick={openCreate}>
          <Plus className="size-4" />
          New Banner
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        The homepage hero slider — unlimited banners, auto-advancing every 4 seconds. Drag to reorder.
        {reordering && " Saving order..."}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {banners === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {banners && banners.length === 0 && <p className="text-sm text-[#444444]">No banners yet.</p>}
        {banners && banners.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={banners.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {banners.map((banner) => (
                  <SortableBannerRow
                    key={banner.id}
                    banner={banner}
                    onToggleActive={handleToggleActive}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{editingId ? "Edit Banner" : "New Banner"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <SingleImageUploader
              uid={admin.uid}
              folder="banner-images"
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              uploadFn={uploadBannerImage}
              label="Banner Image"
              required
              aspectClassName="aspect-[2/1]"
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-title">Title (optional)</Label>
              <Input id="banner-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-11" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-subtitle">Subtitle (optional)</Label>
              <Input
                id="banner-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-button-text">Button Text (optional)</Label>
                <Input
                  id="banner-button-text"
                  value={form.buttonText}
                  onChange={(e) => setForm((f) => ({ ...f, buttonText: e.target.value }))}
                  placeholder="Shop Now"
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-product">Links to Product (optional)</Label>
                <Select
                  value={form.productId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, productId: v === "none" ? "" : (v ?? "") }))}
                >
                  <SelectTrigger id="banner-product" className="h-11 w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!form.productId && (
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
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-start">Start Date (optional)</Label>
                <Input
                  id="banner-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="banner-end">End Date (optional)</Label>
                <Input
                  id="banner-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active (shown on the storefront)
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="mt-2 h-11" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Banner"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
