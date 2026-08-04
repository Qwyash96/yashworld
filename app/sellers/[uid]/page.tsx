import Image from "next/image"
import { notFound } from "next/navigation"
import { Star, Store, BadgeCheck } from "lucide-react"
import { getSellerProfile } from "@/services/seller.service"
import { getPublicProductsBySeller } from "@/services/product.service"
import { toUIProduct } from "@/services/catalog.service"
import { ProductCard } from "@/components/product-card"

export default async function SellerStorefrontPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const seller = await getSellerProfile(uid)
  if (!seller || seller.status !== "approved") notFound()

  const rawProducts = await getPublicProductsBySeller(uid)
  const products = rawProducts.map((p) => toUIProduct(p))

  return (
    <main className="min-h-screen bg-white">
      <div className="relative h-32 w-full bg-gradient-to-r from-green-700 to-green-600 sm:h-48">
        {seller.bannerUrl && <Image src={seller.bannerUrl} alt="" fill className="object-cover" />}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-14">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-green-50 shadow-md sm:size-28">
            {seller.logoUrl ? (
              <Image src={seller.logoUrl} alt={seller.shopName} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Store className="size-8 text-green-700" />
              </div>
            )}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-black sm:text-2xl">{seller.shopName}</h1>
              <BadgeCheck className="size-5 text-green-600" />
            </div>
            {seller.ratingCount > 0 && (
              <p className="flex items-center gap-1 text-sm text-[#444444]">
                <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                {seller.ratingAvg.toFixed(1)} ({seller.ratingCount} ratings)
              </p>
            )}
          </div>
        </div>

        <h2 className="mt-8 text-base font-bold text-black sm:text-lg">Products from {seller.shopName}</h2>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-[#444444]">This seller has no live products right now.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      <div className="h-12" />
    </main>
  )
}
