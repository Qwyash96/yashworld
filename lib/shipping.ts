import type { ShippingMethod } from "@/types/order"

/**
 * Single source of truth for shipping rates — imported by the checkout page
 * (live total display) and the checkout/payment API routes (trusted
 * server-side recomputation), so the two can never disagree.
 */
export const SHIPPING_OPTIONS: {
  id: ShippingMethod
  label: string
  description: string
  getRate: (subtotal: number) => number
}[] = [
  {
    id: "standard",
    label: "Standard Shipping",
    description: "5–7 business days",
    getRate: (subtotal) => (subtotal > 250 || subtotal === 0 ? 0 : 15),
  },
  {
    id: "express",
    label: "Express Shipping",
    description: "2–3 business days",
    getRate: () => 49,
  },
]

export function getShippingRate(method: ShippingMethod, subtotal: number): number {
  const option = SHIPPING_OPTIONS.find((m) => m.id === method) ?? SHIPPING_OPTIONS[0]
  return option.getRate(subtotal)
}
