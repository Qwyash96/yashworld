import { auth } from "@/services/firebase/client"
import type { MaskedPaymentSettings, PaymentSettings } from "@/types/payment-settings"

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

export async function fetchPaymentSettings(): Promise<
  { ok: true; settings: MaskedPaymentSettings } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/payment-settings", { headers })
  const result = await parseResult<MaskedPaymentSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export interface SavePaymentSettingsInput {
  keyId?: string
  keySecret?: string
  webhookSecret?: string
  paymentLink?: string
  methods?: Partial<PaymentSettings["methods"]>
  checkout?: Partial<Omit<PaymentSettings["checkout"], "currency">>
}

export async function savePaymentSettings(
  input: SavePaymentSettingsInput,
): Promise<{ ok: true; settings: MaskedPaymentSettings } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/payment-settings", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<MaskedPaymentSettings>(response)
  if (!result.ok) return result
  return { ok: true, settings: result.data }
}

export async function verifyRazorpayConnection(): Promise<
  { ok: true; connected: true } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/payment-settings/verify", { method: "POST", headers })
  const result = await parseResult<{ connected: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, connected: true }
}
