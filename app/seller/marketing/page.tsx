"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Menu, Megaphone, Package, Plus } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getMySponsoredAds } from "@/lib/seller-ads-client"
import { getEffectiveAdStatus } from "@/lib/sponsored-ad-status"
import { formatPrice } from "@/lib/products"
import { AD_POSITION_LABELS } from "@/types/sponsored-ad"
import type { SponsoredAd, SponsoredAdStatus } from "@/types/sponsored-ad"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SellerSidebar, SellerSidebarContent } from "@/components/seller/seller-sidebar"

const STATUS_STYLES: Record<SponsoredAdStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid: "bg-blue-100 text-blue-700",
  approved: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  running: "bg-green-100 text-green-800",
  expired: "bg-gray-200 text-gray-600",
  paused: "bg-orange-100 text-orange-700",
}

export default function SellerMarketingPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [ads, setAds] = useState<SponsoredAd[] | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!sellerUid) return
    getMySponsoredAds(sellerUid).then(setAds)
  }, [sellerUid])

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
          <h1 className="text-xl font-bold text-gray-900">Seller Access Required</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in as an approved seller to manage your promotions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F8F8F2]">
      <SellerSidebar />

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger aria-label="Open menu" className="rounded-xl border border-gray-200 p-2 text-gray-600 lg:hidden">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Seller Menu</SheetTitle>
                </SheetHeader>
                <SellerSidebarContent />
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Marketing</h1>
              <p className="text-sm text-gray-500">Promote your products on the YashWorld homepage</p>
            </div>
          </div>

          <Link
            href="/seller/marketing/promote"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 sm:px-6 sm:py-3"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Promote a Product</span>
          </Link>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-10">
          {ads === null && <p className="text-sm text-gray-500">Loading...</p>}

          {ads && ads.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-green-200 bg-white py-16 text-center shadow-sm">
              <Megaphone className="size-10 text-green-700" />
              <h2 className="mt-4 text-lg font-bold text-gray-900">No promotions yet</h2>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Get more eyes on your best products by running a Sponsored Ad on the homepage.
              </p>
              <Link
                href="/seller/marketing/promote"
                className="mt-5 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Promote a Product
              </Link>
            </div>
          )}

          {ads && ads.length > 0 && (
            <div className="flex flex-col gap-3">
              {ads.map((ad) => {
                const effectiveStatus = getEffectiveAdStatus(ad)
                return (
                <div
                  key={ad.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {ad.productImage ? (
                        <Image src={ad.productImage} alt={ad.productName} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="size-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{ad.productName}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[effectiveStatus]}`}>
                          {effectiveStatus}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {ad.durationDays} day{ad.durationDays > 1 ? "s" : ""} · {formatPrice(ad.feeAmount)} ·{" "}
                        {AD_POSITION_LABELS[ad.position]}
                      </p>
                      {effectiveStatus === "running" && ad.endAt && (
                        <p className="mt-0.5 text-xs text-green-700">Live until {new Date(ad.endAt).toLocaleDateString()}</p>
                      )}
                      {effectiveStatus === "rejected" && ad.rejectionReason && (
                        <p className="mt-0.5 text-xs text-red-600">Reason: {ad.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
