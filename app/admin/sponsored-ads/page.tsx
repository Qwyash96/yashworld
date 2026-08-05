"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Megaphone, Package, Settings2, Check, X, Pause, Play } from "lucide-react"
import {
  fetchAllSponsoredAds,
  updateSponsoredAd,
  fetchAdPricing,
  saveAdPricing,
} from "@/lib/admin-sponsored-ads-client"
import { getEffectiveAdStatus } from "@/lib/sponsored-ad-status"
import { formatPrice } from "@/lib/products"
import { ProductImage } from "@/components/product-image"
import { sanitizeDigits } from "@/lib/numeric-input"
import { AD_DURATION_OPTIONS, AD_POSITIONS, AD_POSITION_LABELS } from "@/types/sponsored-ad"
import type { SponsoredAd, SponsoredAdStatus, AdPosition } from "@/types/sponsored-ad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_STYLES: Record<SponsoredAdStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid: "bg-blue-100 text-blue-700",
  approved: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  running: "bg-green-100 text-green-800",
  expired: "bg-gray-200 text-gray-600",
  paused: "bg-orange-100 text-orange-700",
}

export default function AdminSponsoredAdsPage() {
  const [ads, setAds] = useState<SponsoredAd[] | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingForm, setPricingForm] = useState<Record<string, string>>({})
  const [savingPricing, setSavingPricing] = useState(false)
  const [filter, setFilter] = useState<"all" | SponsoredAdStatus>("all")

  function refresh() {
    fetchAllSponsoredAds().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAds(result.ads)
    })
  }

  useEffect(() => {
    refresh()
    fetchAdPricing().then((result) => {
      if (!result.ok) return
      setPricingForm(
        Object.fromEntries(Object.entries(result.pricing.feeByDurationDays).map(([k, v]) => [k, String(v)])),
      )
    })
  }, [])

  async function handleAction(ad: SponsoredAd, action: "approve" | "reject" | "pause" | "resume") {
    let rejectionReason: string | undefined
    if (action === "reject") {
      rejectionReason = window.prompt("Reason for rejecting this promotion?") ?? undefined
      if (rejectionReason === undefined) return
    }
    const result = await updateSponsoredAd(ad.id, { action, ...(rejectionReason ? { rejectionReason } : {}) })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Promotion ${action}d.`)
    refresh()
  }

  async function handlePriorityChange(ad: SponsoredAd, priority: number) {
    const result = await updateSponsoredAd(ad.id, { priority })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    refresh()
  }

  async function handlePositionChange(ad: SponsoredAd, position: AdPosition) {
    const result = await updateSponsoredAd(ad.id, { position })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Placement updated.")
    refresh()
  }

  async function handleSavePricing() {
    setSavingPricing(true)
    const parsed = Object.fromEntries(Object.entries(pricingForm).map(([k, v]) => [k, Number(v) || 0]))
    const result = await saveAdPricing(parsed)
    setSavingPricing(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Ad pricing updated.")
  }

  const filteredAds = ads?.filter((ad) => filter === "all" || getEffectiveAdStatus(ad) === filter) ?? null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Megaphone className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Sponsored Ads</h1>
        </div>
        <Button variant="outline" className="h-10" onClick={() => setPricingOpen((o) => !o)}>
          <Settings2 className="size-4" />
          Pricing
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Sellers pay to promote a product in a homepage slot. Approve, reject, reprioritize or reposition below.
      </p>

      {pricingOpen && (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-black">Fee by Duration</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {AD_DURATION_OPTIONS.map((d) => (
              <div key={d} className="flex flex-col gap-1">
                <label className="text-xs text-[#444444]">{d} Day{d > 1 ? "s" : ""}</label>
                <Input
                  inputMode="numeric"
                  value={pricingForm[String(d)] ?? ""}
                  onChange={(e) =>
                    setPricingForm((f) => ({ ...f, [String(d)]: sanitizeDigits(e.target.value) }))
                  }
                  className="h-10"
                />
              </div>
            ))}
          </div>
          <Button className="mt-3 h-9" onClick={handleSavePricing} disabled={savingPricing}>
            {savingPricing ? "Saving..." : "Save Pricing"}
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "pending", "paid", "running", "approved", "paused", "rejected", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === s ? "bg-green-700 text-white" : "bg-[#f3f5f2] text-black hover:bg-green-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {ads === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {filteredAds && filteredAds.length === 0 && <p className="text-sm text-[#444444]">No promotions found.</p>}
        {filteredAds?.map((ad) => {
          const effectiveStatus = getEffectiveAdStatus(ad)
          return (
            <div key={ad.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
                    {ad.productImage ? (
                      <ProductImage src={ad.productImage} alt={ad.productName} className="absolute inset-0" padding="xs" sizes="56px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="size-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-black">{ad.productName}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[effectiveStatus]}`}>
                        {effectiveStatus}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#444444]">
                      Seller {ad.sellerId.slice(0, 8)} · {ad.durationDays} day{ad.durationDays > 1 ? "s" : ""} ·{" "}
                      {formatPrice(ad.feeAmount)}
                      {ad.startAt && ad.endAt
                        ? ` · ${new Date(ad.startAt).toLocaleDateString()} – ${new Date(ad.endAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ad.status === "paid" && (
                    <>
                      <Button size="sm" className="h-9" onClick={() => handleAction(ad, "approve")}>
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9" onClick={() => handleAction(ad, "reject")}>
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                  {ad.status === "pending" && (
                    <Button size="sm" variant="destructive" className="h-9" onClick={() => handleAction(ad, "reject")}>
                      <X className="size-3.5" />
                      Reject
                    </Button>
                  )}
                  {ad.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-9" onClick={() => handleAction(ad, "pause")}>
                      <Pause className="size-3.5" />
                      Pause
                    </Button>
                  )}
                  {ad.status === "paused" && (
                    <Button size="sm" className="h-9" onClick={() => handleAction(ad, "resume")}>
                      <Play className="size-3.5" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>

              {(ad.status === "approved" || ad.status === "paused") && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#444444]">Priority</label>
                    <Input
                      inputMode="numeric"
                      defaultValue={String(ad.priority)}
                      onBlur={(e) => {
                        const value = Number(sanitizeDigits(e.target.value)) || 0
                        if (value !== ad.priority) handlePriorityChange(ad, value)
                      }}
                      className="h-9 w-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#444444]">Position</label>
                    <Select value={ad.position} onValueChange={(v) => v && handlePositionChange(ad, v as AdPosition)}>
                      <SelectTrigger className="h-9 w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AD_POSITIONS.map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {AD_POSITION_LABELS[pos]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {ad.status === "rejected" && ad.rejectionReason && (
                <p className="border-t border-border pt-3 text-xs text-red-600">Reason: {ad.rejectionReason}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
