import type { LucideIcon } from "lucide-react"

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  live,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  live?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
          <Icon className="size-4.5" />
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-green-600">
            <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
            Live
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-black">{value}</p>
      <p className="text-sm text-[#444444]">{label}</p>
      {hint && <p className="mt-1 text-xs text-[#888888]">{hint}</p>}
    </div>
  )
}
