import { SHIPPING_OPTIONS } from "@/lib/shipping"
import type { ShippingMethod } from "@/types/order"

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return result
}

/** A real, deterministic date-range label derived from this app's actual
 * shipping method definitions (lib/shipping.ts's description text, e.g.
 * "5–7 business days") — not a per-item/per-location estimate, matching the
 * app's existing flat two-tier shipping model. Defaults to "standard", the
 * checkout default. */
export function getDeliveryEstimate(method: ShippingMethod = "standard"): string {
  const option = SHIPPING_OPTIONS.find((m) => m.id === method) ?? SHIPPING_OPTIONS[0]!
  const match = option.description.match(/(\d+)[–-](\d+)/)
  if (!match) return option.description

  const minDays = Number(match[1])
  const maxDays = Number(match[2])
  const now = new Date()
  const from = addBusinessDays(now, minDays)
  const to = addBusinessDays(now, maxDays)
  const format = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

  return `Arrives ${format(from)} – ${format(to)}`
}
