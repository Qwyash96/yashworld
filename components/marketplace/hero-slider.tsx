"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Banner } from "@/types/banner"
import { cn } from "@/lib/utils"

const AUTO_ADVANCE_MS = 4000
// A swipe shorter than this reads as a tap/scroll, not an intentional slide change.
const SWIPE_THRESHOLD_PX = 40

function bannerHref(banner: Banner): string | undefined {
  if (banner.productId) return `/products/${banner.productId}`
  return banner.linkUrl
}

/** Real admin-managed banners (Admin → Marketing → Home Banners) — unlimited
 * count, renders nothing when there are none so a fresh install never shows
 * a placeholder slide. All slides render in one sliding track (smooth CSS
 * transform transition) so both auto-advance and swipe feel identical. */
export function HeroSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)

  useEffect(() => {
    if (banners.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) return null

  function go(delta: number) {
    setIndex((i) => (i + delta + banners.length) % banners.length)
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]!.clientX
    touchDeltaX.current = 0
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return
    touchDeltaX.current = e.touches[0]!.clientX - touchStartX.current
  }

  function handleTouchEnd() {
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD_PX) {
      go(touchDeltaX.current < 0 ? 1 : -1)
    }
    touchStartX.current = null
    touchDeltaX.current = 0
  }

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden bg-gray-100 sm:mx-3 sm:mt-3 sm:rounded-2xl lg:mx-auto lg:px-4">
      <div
        className="relative touch-pan-y overflow-hidden sm:rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => {
            const href = bannerHref(banner)
            const slide = (
              <div className="relative h-[170px] w-full shrink-0 overflow-hidden lg:h-[340px]">
                <Image
                  src={banner.imageUrl}
                  alt={banner.title ?? "Promotional banner"}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                  sizes="100vw"
                  className="object-cover"
                />
                {(banner.title || banner.subtitle || banner.buttonText) && (
                  <div className="absolute inset-0 flex flex-col items-start justify-end gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-4 lg:p-6">
                    {banner.title && (
                      <h2 className="max-w-lg text-base font-bold text-white sm:text-xl lg:text-2xl">{banner.title}</h2>
                    )}
                    {banner.subtitle && (
                      <p className="max-w-md text-xs text-white/90 sm:text-sm lg:text-base">{banner.subtitle}</p>
                    )}
                    {banner.buttonText && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black sm:text-sm">
                        {banner.buttonText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
            return (
              <div key={banner.id} className="w-full shrink-0">
                {href ? <Link href={href}>{slide}</Link> : slide}
              </div>
            )
          })}
        </div>

        {banners.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous banner"
              className="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white lg:size-9"
            >
              <ChevronLeft className="size-4 lg:size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next banner"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white lg:size-9"
            >
              <ChevronRight className="size-4 lg:size-5" />
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to banner ${i + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-1.5 bg-white/60")}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
