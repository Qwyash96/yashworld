"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Sprout, Plus, Pencil, Trash2 } from "lucide-react"
import { fetchAdminCategories, createCategoryAdmin, updateCategoryAdmin, deleteCategoryAdmin } from "@/lib/admin-categories-client"
import type { Category } from "@/types/category"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const emptyForm = { name: "", slug: "", description: "", image: "" }

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function refresh() {
    fetchAdminCategories().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCategories(result.categories)
    })
  }

  useEffect(refresh, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setEditingId(category.id)
    setForm({ name: category.name, slug: category.slug, description: category.description, image: category.image })
    setError("")
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required.")
      return
    }
    if (!editingId && !form.slug.trim()) {
      setError("Slug is required.")
      return
    }
    setSaving(true)
    const result = editingId
      ? await updateCategoryAdmin(editingId, { name: form.name, description: form.description, image: form.image })
      : await createCategoryAdmin({ name: form.name, slug: form.slug, description: form.description, image: form.image })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(editingId ? "Category updated." : "Category created.")
    setSheetOpen(false)
    refresh()
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete "${category.name}"? Products already in it will need reassigning first.`)) return
    const result = await deleteCategoryAdmin(category.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category deleted.")
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sprout className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Categories</h1>
        </div>
        <Button className="h-10" onClick={openCreate}>
          <Plus className="size-4" />
          New Category
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Drives the homepage&apos;s category grid, filters, and the storefront&apos;s /categories pages.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {categories === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {categories && categories.length === 0 && <p className="text-sm text-[#444444]">No categories yet.</p>}
        {categories?.map((category) => (
          <div
            key={category.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={category.image || "/placeholder.svg"} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div>
                <p className="font-semibold text-black">{category.name}</p>
                <p className="text-xs text-[#444444]">
                  /{category.slug}
                  {category.description ? ` · ${category.description}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-9" onClick={() => openEdit(category)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="destructive" className="h-9" onClick={() => handleDelete(category)}>
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
            <SheetTitle>{editingId ? "Edit Category" : "New Category"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-slug">Slug{editingId ? " (locked — products reference it)" : ""}</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                disabled={!!editingId}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="indoor-plants"
                className="h-11 disabled:bg-[#f3f5f2]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-description">Description</Label>
              <Input
                id="cat-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-image">Image URL</Label>
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="h-32 w-full rounded-lg object-cover" />
              )}
              <Input
                id="cat-image"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="/placeholder.svg"
                className="h-11"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="mt-2 h-11" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
