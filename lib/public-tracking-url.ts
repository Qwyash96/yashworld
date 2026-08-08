import type { ShippingProviderId } from "@/lib/shipping-service"

/**
 * A courier's own public tracking page for a given AWB — never a status
 * claim of our own, just a link to the provider's real page. Only returns a
 * URL for providers with a known, stable public tracking path; other
 * providers (or a missing AWB) return undefined rather than a guessed link.
 * Client-safe (no "server-only" import) since it's rendered on the buyer's
 * order page.
 */
export function getPublicTrackingUrl(shippingProvider: ShippingProviderId | undefined, awbCode: string | undefined): string | undefined {
  if (!awbCode) return undefined
  if (shippingProvider === "shiprocket") return `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`
  return undefined
}
