import { Shield, Truck, RotateCcw, BadgeCheck, Headset, Leaf, type LucideIcon } from "lucide-react"
import type { TrustBadge } from "@/types/platform-settings"

const ICONS: Record<TrustBadge["icon"], LucideIcon> = {
  shield: Shield,
  truck: Truck,
  "rotate-ccw": RotateCcw,
  "badge-check": BadgeCheck,
  headset: Headset,
  leaf: Leaf,
}

/** Admin-editable (Admin → Settings → General → Trust Badges) — renders nothing if none are configured. */
export function TrustBadges({ badges }: { badges: TrustBadge[] }) {
  if (badges.length === 0) return null

  return (
    <section className="border-y border-border bg-white px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-4">
        {badges.map((badge, i) => {
          const Icon = ICONS[badge.icon] ?? Shield
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-50">
                <Icon className="size-4 text-green-700" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-black">{badge.title}</p>
                <p className="truncate text-[11px] text-[#444444]">{badge.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
