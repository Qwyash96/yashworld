import { auth } from "@/services/firebase/client"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"

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

export async function fetchMyWallet(): Promise<
  { ok: true; wallet: SellerWallet; withdrawals: WithdrawalRequest[] } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/seller/wallet", { headers })
  const result = await parseResult<{ wallet: SellerWallet; withdrawals: WithdrawalRequest[] }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function requestWithdrawal(amount: number): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/seller/wallet/withdraw", { method: "POST", headers, body: JSON.stringify({ amount }) })
  const result = await parseResult<{ id: string }>(response)
  if (!result.ok) return result
  return { ok: true, id: result.data.id }
}
