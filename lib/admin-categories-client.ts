import { auth } from "@/services/firebase/client"
import type { Category, CategoryInput } from "@/types/category"

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

export async function fetchAdminCategories(): Promise<{ ok: true; categories: Category[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/categories", { headers })
  const result = await parseResult<{ categories: Category[] }>(response)
  if (!result.ok) return result
  return { ok: true, categories: result.data.categories }
}

export async function createCategoryAdmin(
  input: Partial<CategoryInput>,
): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/categories", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ category: Category }>(response)
  if (!result.ok) return result
  return { ok: true, category: result.data.category }
}

export async function updateCategoryAdmin(
  id: string,
  patch: Partial<Omit<CategoryInput, "slug">>,
): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/categories/${id}`, { method: "POST", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ category: Category }>(response)
  if (!result.ok) return result
  return { ok: true, category: result.data.category }
}

export async function deleteCategoryAdmin(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/categories/${id}`, { method: "DELETE", headers })
  return parseResult<{ ok: true }>(response)
}
