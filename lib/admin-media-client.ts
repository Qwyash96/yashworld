import { auth } from "@/services/firebase/client"
import type { MediaAsset, MediaFolder } from "@/types/media"

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

export async function fetchMediaAssets(
  folder?: MediaFolder,
): Promise<{ ok: true; assets: MediaAsset[]; totalBytes: number; truncated: boolean } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const url = folder ? `/api/admin/media?folder=${folder}` : "/api/admin/media"
  const response = await fetch(url, { headers })
  const result = await parseResult<{ assets: MediaAsset[]; totalBytes: number; truncated: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function deleteMediaAsset(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/media/${id}`, { method: "DELETE", headers })
  const result = await parseResult<{ ok: true }>(response)
  if (!result.ok) return result
  return { ok: true }
}
