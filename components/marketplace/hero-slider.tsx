"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Banner } from "@/types/banner"
import { cn } from "@/lib/utils"

const AUTO_ADVANCE_MS = 5000

/** Real admin-managed banners (app/admin/banners) — renders nothing when
 * there are none, so a fresh install never shows a placeholder slide. */
export function HeroSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) return null

  const current = banners[index]!

  function go(delta: number) {
    setIndex((i) => (i + delta + banners.length) % banners.length)
  }

  const Slide = (
    <div className="relative h-[170px] w-full overflow-hidden lg:h-[340px]">
      <Image src={current.imageUrl} alt={current.title ?? "Promotional banner"} fill priority className="object-cover" />
      {current.title && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/45 to-transparent p-4 lg:p-6">
          <h2 className="max-w-lg text-base font-bold text-white sm:text-xl lg:text-2xl">{current.title}</h2>
        </div>
      )}
    </div>
  )

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden bg-gray-100 sm:mx-3 sm:mt-3 sm:rounded-2xl lg:mx-auto lg:px-4">
      <div className="relative overflow-hidden sm:rounded-2xl">
        {current.linkUrl ? <Link href={current.linkUrl}>{Slide}</Link> : Slide}

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
