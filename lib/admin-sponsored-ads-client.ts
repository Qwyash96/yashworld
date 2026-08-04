import { auth } from "@/services/firebase/client"
import type { SponsoredAd, AdPosition } from "@/types/sponsored-ad"
import type { AdPricingSettings } from "@/types/platform-settings"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function parseResult<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Request failed." }
  return { ok: true, data: body as T }
}

export async function fetchAllSponsoredAds(): Promise<{ ok: true; ads: SponsoredAd[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/sponsored-ads", { headers })
  const result = await parseResult<{ ads: SponsoredAd[] }>(response)
  if (!result.ok) return result
  return { ok: true, ads: result.data.ads }
}

export async function updateSponsoredAd(
  id: string,
  patch: {
    action?: "approve" | "reject" | "pause" | "resume"
    rejectionReason?: string
    priority?: number
    position?: AdPosition
    startAt?: string
    endAt?: string
  },
): Promise<{ ok: true; ad: SponsoredAd } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/sponsored-ads/${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ ad: SponsoredAd }>(response)
  if (!result.ok) return result
  return { ok: true, ad: result.data.ad }
}

export async function fetchAdPricing(): Promise<{ ok: true; pricing: AdPricingSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/ad-pricing", { headers })
  const result = await parseResult<AdPricingSettings>(response)
  if (!result.ok) return result
  return { ok: true, pricing: result.data }
}

export async function saveAdPricing(
  feeByDurationDays: Partial<Record<"1" | "3" | "7" | "15" | "30", number>>,
): Promise<{ ok: true; pricing: AdPricingSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/ad-pricing", {
    method: "POST",
    headers,
    body: JSON.stringify({ feeByDurationDays }),
  })
  const result = await parseResult<AdPricingSettings>(response)
  if (!result.ok) return result
  return { ok: true, pricing: result.data }
}
