"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import type { Banner } from "@/types/banner"
import { cn } from "@/lib/utils"

const AUTO_ADVANCE_MS = 4000
// A swipe shorter than this reads as a tap/scroll, not an intentional slide change.
const SWIPE_THRESHOLD_PX = 40

function bannerHref(banner: Banner): string | undefined {
  if (banner.productId) return `/products/${banner.productId}`
  return banner.linkUrl
}

/** Real admin-managed banners (Admin → Marketing → Home Banners) only —
 * never a product photo, never repeated elsewhere on the page (see
 * app/page.tsx — this is the ONLY banner-rendering section on the
 * homepage). Unlimited count, renders nothing when there are none so a
 * fresh install (or every banner deleted) never shows a placeholder
 * slide. All slides render in one sliding track (smooth CSS transform
 * transition) so both auto-advance and swipe feel identical. */
export function HeroSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)

  useEffect(() => {
    if (banners.length < 2 || paused) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [banners.length, paused])

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
    <section className="relative mx-0 mt-0 max-w-7xl overflow-hidden sm:mx-4 sm:mt-3 lg:mx-auto lg:px-4">
      <div
        className="relative touch-pan-y overflow-hidden bg-gray-100 sm:rounded-[20px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => {
            const href = bannerHref(banner)
            const slide = (
              <div className="relative h-[240px] w-full shrink-0 overflow-hidden sm:h-[320px] md:h-[380px] lg:h-[440px]">
                <Image
                  src={banner.imageUrl}
                  alt={banner.title ?? "Promotional banner"}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                  sizes="100vw"
                  className="object-cover object-center"
                />
                {(banner.title || banner.subtitle || banner.buttonText) && (
                  <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 sm:gap-2.5 sm:p-6 lg:p-8">
                    {banner.title && (
                      <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700 sm:text-xs">
                        Featured
                      </span>
                    )}
                    {banner.title && (
                      <h2 className="max-w-lg text-xl font-extrabold text-white sm:text-2xl lg:text-4xl">{banner.title}</h2>
                    )}
                    {banner.subtitle && (
                      <p className="max-w-md text-xs text-white/90 sm:text-sm lg:text-base">{banner.subtitle}</p>
                    )}
                    {banner.buttonText && (
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition group-hover:gap-2.5 sm:px-5 sm:py-2.5 sm:text-sm">
                        {banner.buttonText}
                        <ArrowRight className="size-3.5 sm:size-4" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
            return (
              <div key={banner.id} className="w-full shrink-0">
                {href ? <Link href={href} className="group block">{slide}</Link> : slide}
              </div>
            )
          })}
        </div>

        {banners.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous banner"
              className="absolute left-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white lg:size-10"
            >
              <ChevronLeft className="size-4 lg:size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next banner"
              className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white lg:size-10"
            >
              <ChevronRight className="size-4 lg:size-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
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
