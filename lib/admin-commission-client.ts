import { auth } from "@/services/firebase/client"
import type { PlatformSettings } from "@/types/platform-settings"

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

export async function fetchPlatformSettings(): Promise<
  { ok: true; settings: PlatformSettings } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/platform-settings", { headers })
  const result = await parseResult<PlatformSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function savePlatformCommission(
  defaultCommissionPercent: number,
): Promise<{ ok: true; settings: PlatformSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/platform-settings", {
    method: "POST",
    headers,
    body: JSON.stringify({ defaultCommissionPercent }),
  })
  const result = await parseResult<PlatformSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}
