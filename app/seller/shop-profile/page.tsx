"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Menu, Store } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { fetchMyShopProfile, updateMyShopProfile } from "@/lib/seller-shop-profile-client"
import { uploadSellerLogo, uploadSellerBanner } from "@/services/storage.service"
import { SingleImageUploader } from "@/components/media/single-image-uploader"
import type { Seller } from "@/types/seller"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SellerSidebar, SellerSidebarContent } from "@/components/seller/seller-sidebar"

export default function SellerShopProfilePage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [seller, setSeller] = useState<Seller | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!sellerUid) return
    fetchMyShopProfile().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSeller(result.seller)
    })
  }, [sellerUid])

  async function handleLogoChange(url: string) {
    if (!seller) return
    setSeller({ ...seller, logoUrl: url })
    const result = await updateMyShopProfile({ logoUrl: url })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Shop logo updated.")
  }

  async function handleBannerChange(url: string) {
    if (!seller) return
    setSeller({ ...seller, bannerUrl: url })
    const result = await updateMyShopProfile({ bannerUrl: url })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Shop banner updated.")
  }

  if (gate.state !== "approved" || !sellerUid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8F2] px-4">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Seller Access Required</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in as an approved seller to manage your shop profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F8F8F2]">
      <SellerSidebar />

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-10">
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
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Shop Profile</h1>
            <p className="text-sm text-gray-500">Your public storefront branding</p>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-10">
          {!seller && <p className="text-sm text-gray-500">Loading...</p>}
          {seller && (
            <div className="flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-2">
                <Store className="size-5 text-green-700" />
                <div>
                  <p className="font-bold text-gray-900">{seller.shopName}</p>
                  <p className="text-xs text-gray-500">Seller ID: {seller.sellerId}</p>
                </div>
              </div>

              <SingleImageUploader
                uid={sellerUid}
                folder="seller-banners"
                value={seller.bannerUrl ?? ""}
                onChange={handleBannerChange}
                uploadFn={uploadSellerBanner}
                label="Shop Banner"
                aspectClassName="aspect-[3/1]"
              />

              <SingleImageUploader
                uid={sellerUid}
                folder="seller-logos"
                value={seller.logoUrl ?? ""}
                onChange={handleLogoChange}
                uploadFn={uploadSellerLogo}
                label="Shop Logo"
                aspectClassName="aspect-square max-w-40"
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
