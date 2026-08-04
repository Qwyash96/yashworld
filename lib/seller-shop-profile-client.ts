import { auth } from "@/services/firebase/client"
import type { Seller } from "@/types/seller"

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

export async function fetchMyShopProfile(): Promise<{ ok: true; seller: Seller } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/seller/shop-profile", { headers })
  const result = await parseResult<{ seller: Seller }>(response)
  if (!result.ok) return result
  return { ok: true, seller: result.data.seller }
}

export async function updateMyShopProfile(
  patch: { logoUrl?: string; bannerUrl?: string },
): Promise<{ ok: true; seller: Seller } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/seller/shop-profile", { method: "PATCH", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ seller: Seller }>(response)
  if (!result.ok) return result
  return { ok: true, seller: result.data.seller }
}
