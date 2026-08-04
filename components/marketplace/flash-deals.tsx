"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Zap } from "lucide-react"
import type { Campaign } from "@/types/campaign"

function useCountdown(endAt: string): string {
  const [label, setLabel] = useState("")

  useEffect(() => {
    function tick() {
      const diffMs = new Date(endAt).getTime() - Date.now()
      if (diffMs <= 0) {
        setLabel("Ended")
        return
      }
      const hours = Math.floor(diffMs / 3_600_000)
      const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
      const seconds = Math.floor((diffMs % 60_000) / 1_000)
      setLabel(`${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [endAt])

  return label
}

function FlashDealCard({ campaign }: { campaign: Campaign }) {
  const countdown = useCountdown(campaign.endAt)
  const discountLabel = campaign.discountType === "percent" ? `${campaign.discountValue}% OFF` : `₹${campaign.discountValue} OFF`

  const content = (
    <div className="group relative flex h-48 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-5 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      {campaign.bannerImageUrl && (
        <Image src={campaign.bannerImageUrl} alt={campaign.name} fill className="object-cover opacity-40 transition duration-500 group-hover:scale-110" />
      )}
      <div className="relative">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
          <Zap className="size-3.5" />
          {discountLabel}
        </span>
        <h3 className="mt-2 text-lg font-bold">{campaign.name}</h3>
        <p className="mt-1 font-mono text-sm">Ends in {countdown}</p>
      </div>
    </div>
  )

  return campaign.bannerLinkUrl ? <Link href={campaign.bannerLinkUrl}>{content}</Link> : content
}

/** Admin-created flash_sale campaigns (Admin → Marketing → Campaigns) that
 * are currently within their real startAt/endAt window. Renders nothing
 * when none are live. */
export function FlashDeals({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return null

  return (
    <section id="flash-deals" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <Zap className="size-6 fill-orange-500 text-orange-500" />
        <h2 className="text-2xl font-bold text-black">Flash Deals</h2>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Limited-time offers — grab them before they end.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <FlashDealCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </section>
  )
}
