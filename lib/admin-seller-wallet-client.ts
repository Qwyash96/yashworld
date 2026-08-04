import { auth } from "@/services/firebase/client"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"

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

export async function fetchSellerWallet(
  uid: string,
): Promise<{ ok: true; wallet: SellerWallet; withdrawals: WithdrawalRequest[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/sellers/${uid}/wallet`, { headers })
  const result = await parseResult<{ wallet: SellerWallet; withdrawals: WithdrawalRequest[] }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

async function postWithdrawalAction(id: string, action: string, body?: object): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  const response = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  return parseResult<{ ok: true }>(response)
}

export const approveWithdrawal = (id: string) => postWithdrawalAction(id, "approve")
export const rejectWithdrawal = (id: string, reason?: string) => postWithdrawalAction(id, "reject", { reason })
export const markWithdrawalPaid = (id: string) => postWithdrawalAction(id, "mark-paid")
