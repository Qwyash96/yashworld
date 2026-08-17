"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import type { Banner } from "@/types/banner"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const AUTO_CLOSE_MS = 4000

function bannerHref(banner: Banner): string | undefined {
  if (banner.productId) return `/products/${banner.productId}`
  return banner.linkUrl
}

/** Flipkart-style promo popup — shows the top active banner (same data
 * HeroSlider uses) on homepage load, auto-closes after ~4s. Manual close
 * (X button / overlay click / Escape) comes from DialogContent, not
 * reimplemented here. Renders nothing when there's no active banner. */
export function PromoPopup({ banner }: { banner: Banner | undefined }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setOpen(false), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [banner])

  if (!banner) return null

  const href = bannerHref(banner)
  const content = (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl sm:aspect-video">
      <Image src={banner.imageUrl} alt={banner.title ?? "Promotion"} fill sizes="(max-width: 640px) 100vw, 32rem" className="object-cover" />
      {(banner.title || banner.subtitle || banner.buttonText) && (
        <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 sm:p-6">
          {banner.title && <h2 className="max-w-sm text-xl font-extrabold text-white sm:text-2xl">{banner.title}</h2>}
          {banner.subtitle && <p className="max-w-xs text-xs text-white/90 sm:text-sm">{banner.subtitle}</p>}
          {banner.buttonText && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-black sm:px-5 sm:py-2.5 sm:text-sm">
              {banner.buttonText}
              <ArrowRight className="size-3.5 sm:size-4" />
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-2 sm:p-3">{href ? <Link href={href}>{content}</Link> : content}</DialogContent>
    </Dialog>
  )
}
