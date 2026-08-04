import { Store, Star, BadgeCheck } from "lucide-react"
import type { Seller } from "@/types/seller"

/** Admin-curated (Admin → Sellers → a seller → "Featured on Homepage").
 * Renders nothing when no seller is currently featured. */
export function FeaturedSellers({ sellers }: { sellers: Seller[] }) {
  if (sellers.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-black">Featured Sellers</h2>
      <p className="mt-1 text-sm text-[#444444]">Verified sellers our team loves.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sellers.map((seller) => (
          <div key={seller.uid} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-50">
              <Store className="size-6 text-green-700" />
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 font-semibold text-black">
                {seller.shopName}
                <BadgeCheck className="size-4 text-green-600" />
              </p>
              <p className="text-xs text-[#888888]">{seller.sellerId}</p>
            </div>
            {seller.ratingCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-black">
                <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                {seller.ratingAvg.toFixed(1)} ({seller.ratingCount})
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
