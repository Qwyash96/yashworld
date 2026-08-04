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
    <div className="relative h-56 w-full overflow-hidden sm:h-72 lg:h-96">
      <Image src={current.imageUrl} alt={current.title ?? "Promotional banner"} fill priority className="object-cover" />
      {current.title && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-6">
          <h2 className="max-w-lg text-xl font-bold text-white sm:text-3xl">{current.title}</h2>
        </div>
      )}
    </div>
  )

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden rounded-none bg-gray-100 sm:mx-4 sm:mt-4 sm:rounded-3xl lg:mx-auto lg:px-6">
      <div className="relative overflow-hidden sm:rounded-3xl">
        {current.linkUrl ? <Link href={current.linkUrl}>{Slide}</Link> : Slide}

        {banners.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous banner"
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next banner"
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to banner ${i + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/60")}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
