"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Store } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { fetchMyShopProfile, updateMyShopProfile } from "@/lib/seller-shop-profile-client"
import { uploadSellerLogo, uploadSellerBanner } from "@/services/storage.service"
import { SingleImageUploader } from "@/components/media/single-image-uploader"
import type { Seller } from "@/types/seller"

export default function SellerShopProfilePage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [seller, setSeller] = useState<Seller | null>(null)

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
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Seller Access Required</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in as an approved seller to manage your shop profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Shop Profile</h1>
          <p className="text-xs text-gray-500 sm:text-sm">Your public storefront branding</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-6 sm:py-8 lg:px-10">
          {!seller && <p className="text-sm text-gray-500">Loading...</p>}
          {seller && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:gap-6 sm:p-6">
              <div className="flex items-center gap-2">
                <Store className="size-5 text-green-700" />
                <div>
                  <p className="text-sm font-bold text-gray-900 sm:text-base">{seller.shopName}</p>
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
  )
}
