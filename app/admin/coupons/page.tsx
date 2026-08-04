"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Ticket, Plus, Pencil, Trash2 } from "lucide-react"
import { fetchGlobalCoupons, createGlobalCoupon, updateGlobalCoupon, deleteGlobalCoupon } from "@/lib/admin-coupons-client"
import { sanitizeDecimal, sanitizeDigits } from "@/lib/numeric-input"
import { formatPrice } from "@/lib/products"
import type { Coupon, CouponStatus } from "@/types/coupon"
import type { DiscountType } from "@/types/campaign"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_STYLES: Record<CouponStatus, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-gray-200 text-gray-700",
  expired: "bg-red-100 text-red-700",
}

const emptyForm = {
  code: "",
  discountType: "percent" as DiscountType,
  discountValue: "",
  maxDiscountAmount: "",
  minOrderValue: "",
  usageLimit: "",
  usageLimitPerBuyer: "",
  startAt: "",
  endAt: "",
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function refresh() {
    fetchGlobalCoupons().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCoupons(result.coupons)
    })
  }

  useEffect(refresh, [])

  function openCreate() {
    setEditingCode(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  function openEdit(coupon: Coupon) {
    setEditingCode(coupon.code)
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount !== undefined ? String(coupon.maxDiscountAmount) : "",
      minOrderValue: coupon.minOrderValue !== undefined ? String(coupon.minOrderValue) : "",
      usageLimit: coupon.usageLimit !== undefined ? String(coupon.usageLimit) : "",
      usageLimitPerBuyer: coupon.usageLimitPerBuyer !== undefined ? String(coupon.usageLimitPerBuyer) : "",
      startAt: coupon.startAt.slice(0, 16),
      endAt: coupon.endAt.slice(0, 16),
    })
    setError("")
    setSheetOpen(true)
  }

  async function handleSave() {
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

    const shared = {
      discountValue,
      ...(form.maxDiscountAmount.trim() ? { maxDiscountAmount: Number(form.maxDiscountAmount) } : {}),
      ...(form.minOrderValue.trim() ? { minOrderValue: Number(form.minOrderValue) } : {}),
      ...(form.usageLimit.trim() ? { usageLimit: Number(form.usageLimit) } : {}),
      ...(form.usageLimitPerBuyer.trim() ? { usageLimitPerBuyer: Number(form.usageLimitPerBuyer) } : {}),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
    }

    const result = editingCode
      ? await updateGlobalCoupon(editingCode, shared)
      : await createGlobalCoupon({ code: form.code.trim().toUpperCase(), discountType: form.discountType, ...shared })

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(editingCode ? "Coupon updated." : "Coupon created.")
    setSheetOpen(false)
    refresh()
  }

  async function handleToggleStatus(coupon: Coupon) {
    const nextStatus = coupon.status === "active" ? "paused" : "active"
    const result = await updateGlobalCoupon(coupon.code, { status: nextStatus })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Coupon ${nextStatus}.`)
    refresh()
  }

  async function handleDelete(coupon: Coupon) {
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return
    const result = await deleteGlobalCoupon(coupon.code)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Coupon deleted.")
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Ticket className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Global Coupons</h1>
        </div>
        <Button className="h-10" onClick={openCreate}>
          <Plus className="size-4" />
          New Coupon
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Platform-wide codes — these reduce what the buyer pays but never reduce seller payout (the
        platform absorbs the cost). Sellers manage their own coupons separately from their Offers page.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {coupons === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {coupons && coupons.length === 0 && <p className="text-sm text-[#444444]">No global coupons yet.</p>}
        {coupons?.map((coupon) => (
          <div key={coupon.code} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-lg font-bold text-black">{coupon.code}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[coupon.status]}`}>
                  {coupon.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#444444]">
                {coupon.discountType === "percent" ? `${coupon.discountValue}% off` : `${formatPrice(coupon.discountValue)} off`}
                {coupon.minOrderValue ? ` · Min order ${formatPrice(coupon.minOrderValue)}` : ""}
                {" · "}
                {new Date(coupon.startAt).toLocaleDateString()} – {new Date(coupon.endAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-[#444444]">
                Used {coupon.usedCount}
                {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} times · {formatPrice(coupon.totalDiscountGiven)} discount given
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-9" onClick={() => handleToggleStatus(coupon)}>
                {coupon.status === "active" ? "Pause" : "Activate"}
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => openEdit(coupon)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="destructive" className="h-9" onClick={() => handleDelete(coupon)}>
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
            <SheetTitle>{editingCode ? `Edit ${editingCode}` : "New Coupon"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                disabled={!!editingCode}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE20"
                className="h-11 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-type">Discount Type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => v && setForm((f) => ({ ...f, discountType: v as DiscountType }))}
                  disabled={!!editingCode}
                >
                  <SelectTrigger id="discount-type" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-value">Discount Value</Label>
                <Input
                  id="discount-value"
                  inputMode="decimal"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: sanitizeDecimal(e.target.value) }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max-discount">Max Discount (optional)</Label>
                <Input
                  id="max-discount"
                  inputMode="decimal"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: sanitizeDecimal(e.target.value) }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="min-order">Min Order Value (optional)</Label>
                <Input
                  id="min-order"
                  inputMode="decimal"
                  value={form.minOrderValue}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderValue: sanitizeDecimal(e.target.value) }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="usage-limit">Total Usage Limit (optional)</Label>
                <Input
                  id="usage-limit"
                  inputMode="numeric"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: sanitizeDigits(e.target.value) }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="usage-limit-buyer">Per-Buyer Limit (optional)</Label>
                <Input
                  id="usage-limit-buyer"
                  inputMode="numeric"
                  value={form.usageLimitPerBuyer}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimitPerBuyer: sanitizeDigits(e.target.value) }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="mt-2 h-11" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCode ? "Save Changes" : "Create Coupon"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
