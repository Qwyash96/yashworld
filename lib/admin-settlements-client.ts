import { auth } from "@/services/firebase/client"
import type { Order } from "@/types/order"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}` }
}

async function parseResult<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Request failed." }
  return { ok: true, data: body as T }
}

export async function fetchSettlements(
  cursor?: string | null,
): Promise<
  | { ok: true; orders: Order[]; totalCaptured: number; nextCursor: string | null; hasMore: boolean }
  | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  if (cursor) query.set("cursor", cursor)

  const response = await fetch(`/api/admin/settlements?${query.toString()}`, { headers })
  const result = await parseResult<{ orders: Order[]; totalCaptured: number; nextCursor: string | null; hasMore: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}
