import { auth } from "@/services/firebase/client"
import type { SocialLinks } from "@/types/site-settings"

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

export async function fetchSocialLinks(): Promise<{ ok: true; links: SocialLinks } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/social", { headers })
  const result = await parseResult<SocialLinks>(response)
  if (!result.ok) return result
  return { ok: true, links: result.data }
}

export async function saveSocialLinks(
  input: Partial<SocialLinks>,
): Promise<{ ok: true; links: SocialLinks } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/settings/social", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<SocialLinks>(response)
  if (!result.ok) return result
  return { ok: true, links: result.data }
}
