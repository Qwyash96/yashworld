import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const TONE_STYLES = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
} as const

/** Dashboard-only KPI tile — deliberately separate from
 * components/seller/stat-card.tsx (used as-is on Products/Offers) so this
 * redesign never bleeds into pages that weren't asked to change. */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "green",
  trend,
  action,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  /** Small caption under the label, e.g. "This Month" / "Orders" / "Products". */
  sublabel?: string
  tone?: keyof typeof TONE_STYLES
  /** e.g. "↑ 20% — Increase from last month". */
  trend?: string
  /** Optional CTA under the value (e.g. "View Orders", "Restock Now"). */
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
          {sublabel && <p className="text-[11px] text-gray-400 sm:text-xs">{sublabel}</p>}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE_STYLES[tone])}>
          <Icon className="size-4.5" />
        </div>
      </div>

      <p className="mt-2 truncate text-2xl font-bold text-gray-900 sm:text-3xl">{value}</p>

      {trend && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-green-700">
          <TrendingUp className="size-3.5" />
          {trend}
        </p>
      )}

      {action && (
        <Link href={action.href} className="mt-auto pt-3 text-xs font-semibold text-green-700 underline-offset-2 hover:underline sm:text-sm">
          {action.label} →
        </Link>
      )}
    </div>
  )
}
