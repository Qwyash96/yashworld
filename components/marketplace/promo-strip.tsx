import Link from "next/link"
import Image from "next/image"
import type { Banner } from "@/types/banner"

/** A single thin promotional strip — reuses the same real active-banners
 * pool the hero slider draws from (just a different slot/format), never a
 * fabricated placeholder. Renders nothing when there's no banner at this slot. */
export function PromoStrip({ banner }: { banner: Banner | undefined }) {
  if (!banner) return null

  const content = (
    <div className="relative h-14 w-full overflow-hidden rounded-xl sm:h-20">
      <Image src={banner.imageUrl} alt={banner.title ?? "Promotion"} fill className="object-cover" />
      {banner.title && (
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/45 to-transparent px-4">
          <p className="text-xs font-semibold text-white sm:text-base">{banner.title}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 lg:px-8">
      {banner.linkUrl ? <Link href={banner.linkUrl}>{content}</Link> : content}
    </div>
  )
}
