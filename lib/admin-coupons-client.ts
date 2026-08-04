import { auth } from "@/services/firebase/client"
import type { Coupon } from "@/types/coupon"
import type { DiscountType } from "@/types/campaign"

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

export interface CreateGlobalCouponInput {
  code: string
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount?: number
  minOrderValue?: number
  usageLimit?: number
  usageLimitPerBuyer?: number
  startAt: string
  endAt: string
  bannerImageUrl?: string
}

export async function fetchGlobalCoupons(): Promise<{ ok: true; coupons: Coupon[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/coupons", { headers })
  const result = await parseResult<{ coupons: Coupon[] }>(response)
  if (!result.ok) return result
  return { ok: true, coupons: result.data.coupons }
}

export async function createGlobalCoupon(
  input: CreateGlobalCouponInput,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/coupons", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ code: string }>(response)
  if (!result.ok) return result
  return { ok: true, code: result.data.code }
}

export async function updateGlobalCoupon(
  code: string,
  patch: Partial<Omit<CreateGlobalCouponInput, "code" | "discountType">> & { status?: Coupon["status"] },
): Promise<{ ok: true; coupon: Coupon } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/coupons/${code}`, { method: "PATCH", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ coupon: Coupon }>(response)
  if (!result.ok) return result
  return { ok: true, coupon: result.data.coupon }
}

export async function deleteGlobalCoupon(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/coupons/${code}`, { method: "DELETE", headers })
  return parseResult<{ ok: true }>(response)
}
