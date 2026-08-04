"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Megaphone, Plus } from "lucide-react"
import { fetchCampaigns, createCampaign } from "@/lib/admin-campaigns-client"
import { getCategoryCatalog } from "@/services/catalog.service"
import { sanitizeDecimal } from "@/lib/numeric-input"
import { formatPrice } from "@/lib/products"
import type { Campaign, CampaignEnrollmentMode, CampaignType, DiscountType } from "@/types/campaign"
import type { Category } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const TYPE_LABELS: Record<CampaignType, string> = {
  flash_sale: "Flash Sale",
  festival_sale: "Festival Sale",
  category_discount: "Category Discount",
}

const STATUS_STYLES: Record<Campaign["status"], string> = {
  draft: "bg-gray-200 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-800",
  ended: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
}

const emptyForm = {
  name: "",
  type: "flash_sale" as CampaignType,
  discountType: "percent" as DiscountType,
  discountValue: "",
  categoryIds: [] as string[],
  startAt: "",
  endAt: "",
  enrollmentMode: "open" as CampaignEnrollmentMode,
  maxDiscountAmount: "",
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function refresh() {
    fetchCampaigns().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCampaigns(result.campaigns)
    })
  }

  useEffect(() => {
    refresh()
    getCategoryCatalog().then(setCategories)
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((c) => c !== id) : [...f.categoryIds, id],
    }))
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setError("Name is required.")
      return
    }
    const discountValue = Number(form.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError("Discount value must be greater than 0.")
      return
    }
    if (!form.startAt || !form.endAt) {
      setError("Start and end dates are required.")
      return
    }
    setSaving(true)
    const result = await createCampaign({
      name: form.name.trim(),
      type: form.type,
      discountType: form.discountType,
      discountValue,
      ...(form.categoryIds.length > 0 ? { categoryIds: form.categoryIds } : {}),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      enrollmentMode: form.enrollmentMode,
      ...(form.maxDiscountAmount.trim() ? { maxDiscountAmount: Number(form.maxDiscountAmount) } : {}),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success("Campaign created.")
    setSheetOpen(false)
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Megaphone className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Campaigns</h1>
        </div>
        <Button className="h-10" onClick={openCreate}>
          <Plus className="size-4" />
          New Campaign
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Flash sales, festival sales and category discounts. Sellers opt in (or you can invite them)
        before the discount applies to their products.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {campaigns === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {campaigns && campaigns.length === 0 && (
          <p className="text-sm text-[#444444]">No campaigns yet — create one to get started.</p>
        )}
        {campaigns?.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/admin/campaigns/${campaign.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-green-50/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-black">{campaign.name}</p>
                <span className="rounded-full bg-[#f3f5f2] px-2.5 py-0.5 text-xs font-semibold text-black">
                  {TYPE_LABELS[campaign.type]}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[campaign.status]}`}>
                  {campaign.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#444444]">
                {campaign.discountType === "percent" ? `${campaign.discountValue}% off` : `${formatPrice(campaign.discountValue)} off`}
                {" · "}
                {new Date(campaign.startAt).toLocaleDateString()} – {new Date(campaign.endAt).toLocaleDateString()}
                {" · "}
                {campaign.enrollmentMode === "open" ? "Open enrollment" : "Invite only"}
              </p>
            </div>
            {campaign.stats && (
              <div className="flex gap-4 text-xs text-[#444444]">
                <div>
                  <p className="font-semibold text-black">{campaign.stats.ordersCount}</p>
                  <p>Orders</p>
                </div>
                <div>
                  <p className="font-semibold text-black">{formatPrice(campaign.stats.revenue)}</p>
                  <p>Revenue</p>
                </div>
                <div>
                  <p className="font-semibold text-black">{formatPrice(campaign.stats.discountGiven)}</p>
                  <p>Discount Given</p>
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>New Campaign</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="c-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v as CampaignType }))}>
                <SelectTrigger id="c-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as CampaignType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-discount-type">Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v) => v && setForm((f) => ({ ...f, discountType: v as DiscountType }))}>
                  <SelectTrigger id="c-discount-type" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-discount-value">Discount Value</Label>
                <Input
                  id="c-discount-value"
                  inputMode="decimal"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: sanitizeDecimal(e.target.value) }))}
                  className="h-11"
                />
              </div>
            </div>

            {form.discountType === "percent" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-max-discount">Max Discount Amount (optional)</Label>
                <Input
                  id="c-max-discount"
                  inputMode="decimal"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: sanitizeDecimal(e.target.value) }))}
                  className="h-11"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-start">Start</Label>
                <Input
                  id="c-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-end">End</Label>
                <Input
                  id="c-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="c-enrollment">Seller Enrollment</Label>
              <Select
                value={form.enrollmentMode}
                onValueChange={(v) => v && setForm((f) => ({ ...f, enrollmentMode: v as CampaignEnrollmentMode }))}
              >
                <SelectTrigger id="c-enrollment" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open — any approved seller can join</SelectItem>
                  <SelectItem value="invite_only">Invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Restrict to Categories (optional)</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {categories.map((cat) => (
                  <label key={cat.slug} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[#f3f5f2]">
                    <input type="checkbox" checked={form.categoryIds.includes(cat.slug)} onChange={() => toggleCategory(cat.slug)} />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="mt-2 h-11" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
