import { auth } from "@/services/firebase/client"

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

export async function fetchCategoryImages(): Promise<
  { ok: true; images: Record<string, string> } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/category-images", { headers })
  const result = await parseResult<{ images: Record<string, string> }>(response)
  if (!result.ok) return result
  return { ok: true, images: result.data.images }
}

export async function saveCategoryImage(slug: string, imageUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/category-images", {
    method: "PUT",
    headers,
    body: JSON.stringify({ slug, imageUrl }),
  })
  const result = await parseResult<{ ok: true }>(response)
  if (!result.ok) return result
  return { ok: true }
}
