import { auth } from "@/services/firebase/client"
import type { UserProfile } from "@/types/user"

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

export interface FetchUsersParams {
  status?: string
  search?: string
  cursor?: string | null
}

export async function fetchBuyers(
  params: FetchUsersParams,
): Promise<{ ok: true; users: UserProfile[]; nextCursor: string | null; hasMore: boolean } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.search) query.set("search", params.search)
  if (params.cursor) query.set("cursor", params.cursor)

  const response = await fetch(`/api/admin/users?${query.toString()}`, { headers })
  const result = await parseResult<{ users: UserProfile[]; nextCursor: string | null; hasMore: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function fetchBuyerDetail(uid: string): Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/users/${uid}`, { headers })
  const result = await parseResult<{ user: UserProfile }>(response)
  if (!result.ok) return result
  return { ok: true, user: result.data.user }
}

async function postAction(uid: string, action: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/users/${uid}/${action}`, { method: "POST", headers })
  return parseResult<{ ok: true }>(response)
}

export const suspendBuyer = (uid: string) => postAction(uid, "suspend")
export const banBuyer = (uid: string) => postAction(uid, "ban")
export const activateBuyer = (uid: string) => postAction(uid, "activate")
export const verifyBuyerEmail = (uid: string) => postAction(uid, "verify-email")
export const verifyBuyerPhone = (uid: string) => postAction(uid, "verify-phone")
