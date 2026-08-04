import { auth } from "@/services/firebase/client"
import type { PayoutRow } from "@/types/wallet"

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

export async function fetchPayouts(
  params: { status?: string; cursor?: string | null } = {},
): Promise<{ ok: true; payouts: PayoutRow[]; nextCursor: string | null; hasMore: boolean } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.cursor) query.set("cursor", params.cursor)

  const response = await fetch(`/api/admin/payouts?${query.toString()}`, { headers })
  const result = await parseResult<{ payouts: PayoutRow[]; nextCursor: string | null; hasMore: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}
