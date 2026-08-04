import Link from "next/link"
import Image from "next/image"
import type { SponsoredAd } from "@/types/sponsored-ad"

/** Position 2/3/4 — a thin "Sponsored" strip for the highest-priority
 * running ad in that slot (real, paid seller promotions — see
 * app/seller/marketing/promote and app/admin/sponsored-ads). Renders
 * nothing when no seller currently has a live ad in this slot. */
export function SponsoredAdSlot({ ads }: { ads: SponsoredAd[] }) {
  if (ads.length === 0) return null
  const ad = ads[0]!

  return (
    <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 lg:px-8">
      <Link
        href={`/products/${ad.productId}`}
        className="flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-white p-3 shadow-sm transition hover:shadow-md sm:p-4"
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:size-16">
          {ad.productImage && <Image src={ad.productImage} alt={ad.productName} fill className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Sponsored
          </span>
          <p className="mt-1 truncate text-sm font-semibold text-black sm:text-base">{ad.productName}</p>
          <p className="text-xs font-medium text-green-700">Shop Now →</p>
        </div>
      </Link>
    </div>
  )
}
