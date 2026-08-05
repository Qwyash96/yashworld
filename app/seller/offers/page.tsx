"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Tag, Ticket, Megaphone, BarChart3, Pencil, X } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getProductsBySeller, setScheduledOffer, clearScheduledOffer } from "@/services/product.service"
import { getOrdersBySeller } from "@/services/order.service"
import {
  listSellerCoupons,
  createSellerCoupon,
  updateSellerCoupon,
  deleteSellerCoupon,
} from "@/services/coupon.service"
import {
  listCampaigns,
  listSellerParticipations,
  joinCampaign,
  declineCampaignInvite,
} from "@/services/campaign.service"
import { sanitizeDecimal, sanitizeDigits } from "@/lib/numeric-input"
import { formatPrice } from "@/lib/products"
import { Price } from "@/components/price"
import { getCoverImageUrl } from "@/lib/product-images"
import { ProductImage } from "@/components/product-image"
import type { Product } from "@/types/product"
import type { Coupon } from "@/types/coupon"
import type { Campaign, CampaignParticipant, DiscountType } from "@/types/campaign"
import type { DiscountSource, Order } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/seller/stat-card"

const emptyOfferForm = { price: "", startAt: "", endAt: "" }
const emptyCouponForm = {
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

const ANALYTICS_SOURCES: { source: DiscountSource; label: string }[] = [
  { source: "scheduled_offer", label: "Scheduled Offers" },
  { source: "campaign", label: "Campaigns" },
  { source: "seller_coupon", label: "My Coupons" },
]

export default function SellerOffersPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [products, setProducts] = useState<Product[] | null>(null)
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [participations, setParticipations] = useState<CampaignParticipant[] | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)

  const [offerSheetProduct, setOfferSheetProduct] = useState<Product | null>(null)
  const [offerForm, setOfferForm] = useState(emptyOfferForm)
  const [offerSaving, setOfferSaving] = useState(false)

  const [couponSheetOpen, setCouponSheetOpen] = useState(false)
  const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null)
  const [couponForm, setCouponForm] = useState(emptyCouponForm)
  const [couponError, setCouponError] = useState("")
  const [couponSaving, setCouponSaving] = useState(false)

  const [joiningId, setJoiningId] = useState<string | null>(null)

  function refreshAll(uid: string) {
    getProductsBySeller(uid).then(setProducts)
    listSellerCoupons(uid).then(setCoupons)
    listCampaigns().then(setCampaigns)
    listSellerParticipations(uid).then(setParticipations)
    getOrdersBySeller(uid).then(setOrders)
  }

  useEffect(() => {
    if (!sellerUid) return
    refreshAll(sellerUid)
  }, [sellerUid])

  const analytics = useMemo(() => {
    if (!orders || !sellerUid) return null
    const totals: Record<DiscountSource, { count: number; revenue: number; discountGiven: number }> = {
      none: { count: 0, revenue: 0, discountGiven: 0 },
      seller_price: { count: 0, revenue: 0, discountGiven: 0 },
      scheduled_offer: { count: 0, revenue: 0, discountGiven: 0 },
      campaign: { count: 0, revenue: 0, discountGiven: 0 },
      seller_coupon: { count: 0, revenue: 0, discountGiven: 0 },
    }
    for (const order of orders) {
      const mine = order.sellerOrders.find((so) => so.sellerId === sellerUid)
      if (!mine || mine.status === "Cancelled") continue
      for (const item of mine.items) {
        const source = item.discountSource ?? "none"
        totals[source].count += item.quantity
        totals[source].revenue += item.price * item.quantity
        if (item.originalPrice !== undefined) {
          totals[source].discountGiven += (item.originalPrice - item.price) * item.quantity
        }
      }
    }
    return totals
  }, [orders, sellerUid])

  function openOfferSheet(product: Product) {
    setOfferSheetProduct(product)
    setOfferForm(
      product.scheduledOffer
        ? {
            price: String(product.scheduledOffer.price),
            startAt: product.scheduledOffer.startAt.slice(0, 16),
            endAt: product.scheduledOffer.endAt.slice(0, 16),
          }
        : emptyOfferForm,
    )
  }

  async function handleSaveOffer() {
    if (!offerSheetProduct) return
    const price = Number(offerForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid offer price.")
      return
    }
    if (!offerForm.startAt || !offerForm.endAt || new Date(offerForm.startAt) >= new Date(offerForm.endAt)) {
      toast.error("End must be after start.")
      return
    }
    setOfferSaving(true)
    try {
      await setScheduledOffer(offerSheetProduct.id, {
        price,
        startAt: new Date(offerForm.startAt).toISOString(),
        endAt: new Date(offerForm.endAt).toISOString(),
      })
      toast.success("Scheduled offer saved.")
      setOfferSheetProduct(null)
      if (sellerUid) refreshAll(sellerUid)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save offer.")
    } finally {
      setOfferSaving(false)
    }
  }

  async function handleClearOffer(product: Product) {
    try {
      await clearScheduledOffer(product.id)
      toast.success("Scheduled offer cleared.")
      if (sellerUid) refreshAll(sellerUid)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear offer.")
    }
  }

  function openCreateCoupon() {
    setEditingCouponCode(null)
    setCouponForm(emptyCouponForm)
    setCouponError("")
    setCouponSheetOpen(true)
  }

  function openEditCoupon(coupon: Coupon) {
    setEditingCouponCode(coupon.code)
    setCouponForm({
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
    setCouponError("")
    setCouponSheetOpen(true)
  }

  async function handleSaveCoupon() {
    if (!sellerUid) return
    const discountValue = Number(couponForm.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setCouponError("Discount value must be greater than 0.")
      return
    }
    if (couponForm.discountType === "percent" && discountValue > 100) {
      setCouponError("A percent discount cannot exceed 100.")
      return
    }
    if (!couponForm.startAt || !couponForm.endAt || new Date(couponForm.startAt) >= new Date(couponForm.endAt)) {
      setCouponError("End date must be after the start date.")
      return
    }
    const code = couponForm.code.trim().toUpperCase()
    if (!editingCouponCode && !/^[A-Z0-9]{3,20}$/.test(code)) {
      setCouponError("Code must be 3-20 uppercase letters/numbers.")
      return
    }

    setCouponSaving(true)
    try {
      const shared = {
        discountValue,
        ...(couponForm.maxDiscountAmount.trim() ? { maxDiscountAmount: Number(couponForm.maxDiscountAmount) } : {}),
        ...(couponForm.minOrderValue.trim() ? { minOrderValue: Number(couponForm.minOrderValue) } : {}),
        ...(couponForm.usageLimit.trim() ? { usageLimit: Number(couponForm.usageLimit) } : {}),
        ...(couponForm.usageLimitPerBuyer.trim() ? { usageLimitPerBuyer: Number(couponForm.usageLimitPerBuyer) } : {}),
        startAt: new Date(couponForm.startAt).toISOString(),
        endAt: new Date(couponForm.endAt).toISOString(),
      }
      if (editingCouponCode) {
        await updateSellerCoupon(editingCouponCode, shared)
      } else {
        await createSellerCoupon({
          code,
          scope: "seller",
          sellerId: sellerUid,
          discountType: couponForm.discountType,
          status: "active",
          createdBy: sellerUid,
          ...shared,
        })
      }
      toast.success(editingCouponCode ? "Coupon updated." : "Coupon created.")
      setCouponSheetOpen(false)
      refreshAll(sellerUid)
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "Failed to save coupon.")
    } finally {
      setCouponSaving(false)
    }
  }

  async function handleDeleteCoupon(coupon: Coupon) {
    if (!sellerUid) return
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return
    try {
      await deleteSellerCoupon(coupon.code)
      toast.success("Coupon deleted.")
      refreshAll(sellerUid)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete coupon.")
    }
  }

  async function handleJoin(campaignId: string) {
    setJoiningId(campaignId)
    const result = await joinCampaign(campaignId)
    setJoiningId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Joined — ${result.enrolledCount} product(s) enrolled.`)
    if (sellerUid) refreshAll(sellerUid)
  }

  async function handleDecline(campaignId: string) {
    if (!sellerUid) return
    try {
      await declineCampaignInvite(campaignId, sellerUid)
      toast.success("Invite declined.")
      refreshAll(sellerUid)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to decline invite.")
    }
  }

  if (gate.state === "loading") {
    return (
      <div className="flex min-h-screen bg-[#F8F8F2]">
        <div className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block" />
        <div className="flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-64 animate-pulse rounded-3xl bg-gray-200" />
        </div>
      </div>
    )
  }

  if (gate.state !== "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8F2] px-4">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
            <Tag className="h-7 w-7 text-green-700" />
          </div>
          <h1 className="mt-6 text-xl font-bold text-gray-900">Offers</h1>
          <p className="mt-2 text-sm text-gray-500">Only approved sellers can manage offers.</p>
          <Link
            href="/seller/products"
            className="mt-6 inline-block rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const participationBySellerCampaign = new Map((participations ?? []).map((p) => [p.campaignId, p]))
  const invited = (campaigns ?? []).filter((c) => participationBySellerCampaign.get(c.id)?.status === "invited")
  const joined = (campaigns ?? []).filter((c) => participationBySellerCampaign.get(c.id)?.status === "opted_in")
  const joinable = (campaigns ?? []).filter(
    (c) =>
      c.enrollmentMode === "open" &&
      (c.status === "active" || c.status === "scheduled") &&
      !participationBySellerCampaign.has(c.id),
  )

  return (
    <div>
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Offers</h1>
          <p className="text-xs text-gray-500 sm:text-sm">Scheduled offers, your coupons, and campaign participation.</p>
        </div>
      </header>

      <main className="space-y-6 px-3 py-4 sm:space-y-10 sm:px-6 sm:py-8 lg:px-10">
          {/* Analytics */}
          {analytics && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 sm:text-sm">
                <BarChart3 className="size-4 text-green-700" />
                Offer Analytics
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ANALYTICS_SOURCES.map(({ source, label }) => (
                  <StatCard
                    key={source}
                    icon={Tag}
                    label={`${label} — ${analytics[source].count} sold, ${formatPrice(analytics[source].discountGiven)} discounted`}
                    value={formatPrice(analytics[source].revenue)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Scheduled Offers */}
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 sm:text-sm">
              <Tag className="size-4 text-green-700" />
              Scheduled Offers
            </h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {products === null ? (
                <p className="p-4 text-sm text-gray-500 sm:p-6">Loading...</p>
              ) : products.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 sm:p-6">You have no products yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <div key={product.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImage src={getCoverImageUrl(product.images)} alt={product.name} className="h-10 w-11 shrink-0 rounded-lg sm:h-12 sm:w-12" padding="xs" sizes="48px" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                          <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
                          {product.scheduledOffer && (
                            <p className="text-xs text-green-700">
                              {formatPrice(product.scheduledOffer.price)} from {new Date(product.scheduledOffer.startAt).toLocaleString()} to{" "}
                              {new Date(product.scheduledOffer.endAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="h-9 flex-1 sm:flex-none" onClick={() => openOfferSheet(product)}>
                          <Pencil className="size-3.5" />
                          {product.scheduledOffer ? "Edit" : "Set Offer"}
                        </Button>
                        {product.scheduledOffer && (
                          <Button size="sm" variant="destructive" className="h-9 flex-1 sm:flex-none" onClick={() => handleClearOffer(product)}>
                            <X className="size-3.5" />
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* My Coupons */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 sm:text-sm">
                <Ticket className="size-4 text-green-700" />
                My Coupons
              </h2>
              <Button size="sm" className="h-9" onClick={openCreateCoupon}>
                New Coupon
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:gap-3">
              {coupons === null && <p className="text-sm text-gray-500">Loading...</p>}
              {coupons && coupons.length === 0 && <p className="text-sm text-gray-500">You have no coupons yet.</p>}
              {coupons?.map((coupon) => (
                <div key={coupon.code} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-gray-900">{coupon.code}</p>
                    <p className="text-xs text-gray-500 sm:text-sm">
                      {coupon.discountType === "percent" ? `${coupon.discountValue}% off` : `${formatPrice(coupon.discountValue)} off`}
                      {" · "}
                      {new Date(coupon.startAt).toLocaleDateString()} – {new Date(coupon.endAt).toLocaleDateString()}
                      {" · "}
                      Used {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} times
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-9 flex-1 sm:flex-none" onClick={() => openEditCoupon(coupon)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="h-9 flex-1 sm:flex-none" onClick={() => handleDeleteCoupon(coupon)}>
                      <X className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Campaigns */}
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 sm:text-sm">
              <Megaphone className="size-4 text-green-700" />
              Campaigns
            </h2>

            {invited.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Invited</p>
                <div className="mt-2 flex flex-col gap-2">
                  {invited.map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <CampaignSummary campaign={c} />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-9 flex-1 sm:flex-none" disabled={joiningId === c.id} onClick={() => handleJoin(c.id)}>
                          {joiningId === c.id ? "Joining..." : "Accept"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 flex-1 sm:flex-none" onClick={() => handleDecline(c.id)}>
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Open to Join</p>
              <div className="mt-2 flex flex-col gap-2">
                {joinable.length === 0 && <p className="text-sm text-gray-500">No open campaigns right now.</p>}
                {joinable.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <CampaignSummary campaign={c} />
                    <Button size="sm" className="h-9" disabled={joiningId === c.id} onClick={() => handleJoin(c.id)}>
                      {joiningId === c.id ? "Joining..." : "Join"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {joined.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Joined</p>
                <div className="mt-2 flex flex-col gap-2">
                  {joined.map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-green-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <CampaignSummary campaign={c} />
                      <span className="w-fit rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Joined</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>

      {/* Scheduled Offer Sheet */}
      <Sheet open={!!offerSheetProduct} onOpenChange={(open) => !open && setOfferSheetProduct(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{offerSheetProduct?.name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="offer-price">Offer Price</Label>
              <Input
                id="offer-price"
                inputMode="decimal"
                value={offerForm.price}
                onChange={(e) => setOfferForm((f) => ({ ...f, price: sanitizeDecimal(e.target.value) }))}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="offer-start">Start</Label>
                <Input
                  id="offer-start"
                  type="datetime-local"
                  value={offerForm.startAt}
                  onChange={(e) => setOfferForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="offer-end">End</Label>
                <Input
                  id="offer-end"
                  type="datetime-local"
                  value={offerForm.endAt}
                  onChange={(e) => setOfferForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            <Button className="mt-2 h-10" onClick={handleSaveOffer} disabled={offerSaving}>
              {offerSaving ? "Saving..." : "Save Offer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Coupon Sheet */}
      <Sheet open={couponSheetOpen} onOpenChange={setCouponSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{editingCouponCode ? `Edit ${editingCouponCode}` : "New Coupon"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="s-code">Code</Label>
              <Input
                id="s-code"
                disabled={!!editingCouponCode}
                value={couponForm.code}
                onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="MYPLANT10"
                className="h-10 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-discount-type">Discount Type</Label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(v) => v && setCouponForm((f) => ({ ...f, discountType: v as DiscountType }))}
                  disabled={!!editingCouponCode}
                >
                  <SelectTrigger id="s-discount-type" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-discount-value">Discount Value</Label>
                <Input
                  id="s-discount-value"
                  inputMode="decimal"
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: sanitizeDecimal(e.target.value) }))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-max-discount">Max Discount (optional)</Label>
                <Input
                  id="s-max-discount"
                  inputMode="decimal"
                  value={couponForm.maxDiscountAmount}
                  onChange={(e) => setCouponForm((f) => ({ ...f, maxDiscountAmount: sanitizeDecimal(e.target.value) }))}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-min-order">Min Order (optional)</Label>
                <Input
                  id="s-min-order"
                  inputMode="decimal"
                  value={couponForm.minOrderValue}
                  onChange={(e) => setCouponForm((f) => ({ ...f, minOrderValue: sanitizeDecimal(e.target.value) }))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-usage-limit">Total Usage Limit (optional)</Label>
                <Input
                  id="s-usage-limit"
                  inputMode="numeric"
                  value={couponForm.usageLimit}
                  onChange={(e) => setCouponForm((f) => ({ ...f, usageLimit: sanitizeDigits(e.target.value) }))}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-usage-limit-buyer">Per-Buyer Limit (optional)</Label>
                <Input
                  id="s-usage-limit-buyer"
                  inputMode="numeric"
                  value={couponForm.usageLimitPerBuyer}
                  onChange={(e) => setCouponForm((f) => ({ ...f, usageLimitPerBuyer: sanitizeDigits(e.target.value) }))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-start">Start</Label>
                <Input
                  id="s-start"
                  type="datetime-local"
                  value={couponForm.startAt}
                  onChange={(e) => setCouponForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-end">End</Label>
                <Input
                  id="s-end"
                  type="datetime-local"
                  value={couponForm.endAt}
                  onChange={(e) => setCouponForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            {couponError && <p className="text-sm text-destructive">{couponError}</p>}
            <Button className="mt-2 h-10" onClick={handleSaveCoupon} disabled={couponSaving}>
              {couponSaving ? "Saving..." : editingCouponCode ? "Save Changes" : "Create Coupon"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CampaignSummary({ campaign }: { campaign: Campaign }) {
  return (
    <div>
      <p className="font-medium text-gray-900">{campaign.name}</p>
      <p className="text-sm text-gray-500">
        {campaign.discountType === "percent" ? `${campaign.discountValue}% off` : `${formatPrice(campaign.discountValue)} off`}
        {" · "}
        {new Date(campaign.startAt).toLocaleDateString()} – {new Date(campaign.endAt).toLocaleDateString()}
      </p>
    </div>
  )
}
