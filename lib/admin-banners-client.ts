import { auth } from "@/services/firebase/client"
import type { Banner, BannerInput } from "@/types/banner"

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

export async function fetchBanners(): Promise<{ ok: true; banners: Banner[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/banners", { headers })
  const result = await parseResult<{ banners: Banner[] }>(response)
  if (!result.ok) return result
  return { ok: true, banners: result.data.banners }
}

export async function createBanner(input: BannerInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/banners", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ id: string }>(response)
  if (!result.ok) return result
  return { ok: true, id: result.data.id }
}

export async function updateBanner(
  id: string,
  patch: Partial<BannerInput>,
): Promise<{ ok: true; banner: Banner } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/banners/${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ banner: Banner }>(response)
  if (!result.ok) return result
  return { ok: true, banner: result.data.banner }
}

export async function deleteBanner(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/banners/${id}`, { method: "DELETE", headers })
  return parseResult<{ ok: true }>(response)
}
