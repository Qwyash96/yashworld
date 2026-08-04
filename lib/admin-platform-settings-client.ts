import { auth } from "@/services/firebase/client"
import type { GeneralSettings, ShippingSettings, TrustBadgesSettings } from "@/types/platform-settings"

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

export async function fetchGeneralSettings(): Promise<{ ok: true; settings: GeneralSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/general", { headers })
  const result = await parseResult<GeneralSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function saveGeneralSettingsClient(
  patch: Partial<Pick<GeneralSettings, "siteName" | "supportEmail" | "supportPhone" | "maintenanceMode">>,
): Promise<{ ok: true; settings: GeneralSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/general", { method: "POST", headers, body: JSON.stringify(patch) })
  const result = await parseResult<GeneralSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function fetchShippingSettings(): Promise<{ ok: true; settings: ShippingSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/shipping", { headers })
  const result = await parseResult<ShippingSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function saveShippingSettingsClient(
  patch: Partial<Pick<ShippingSettings, "standardRate" | "standardFreeThreshold" | "expressRate">>,
): Promise<{ ok: true; settings: ShippingSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/shipping", { method: "POST", headers, body: JSON.stringify(patch) })
  const result = await parseResult<ShippingSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function fetchTrustBadgesSettings(): Promise<{ ok: true; settings: TrustBadgesSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/trust-badges", { headers })
  const result = await parseResult<TrustBadgesSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function saveTrustBadgesSettingsClient(
  badges: TrustBadgesSettings["badges"],
): Promise<{ ok: true; settings: TrustBadgesSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/trust-badges", { method: "POST", headers, body: JSON.stringify({ badges }) })
  const result = await parseResult<TrustBadgesSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}
