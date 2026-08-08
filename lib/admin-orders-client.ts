import { auth } from "@/services/firebase/client"
import type { Order, PaymentMethod } from "@/types/order"
import type { RefundBreakdown, RefundRequest } from "@/types/refund"

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

export interface FetchOrdersParams {
  status?: string
  paymentStatus?: string
  search?: string
  cursor?: string | null
}

export async function fetchOrders(
  params: FetchOrdersParams,
): Promise<{ ok: true; orders: Order[]; nextCursor: string | null; hasMore: boolean } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus)
  if (params.search) query.set("search", params.search)
  if (params.cursor) query.set("cursor", params.cursor)

  const response = await fetch(`/api/admin/orders?${query.toString()}`, { headers })
  const result = await parseResult<{ orders: Order[]; nextCursor: string | null; hasMore: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export interface RefundDetail {
  order: {
    id: string
    contactEmail: string
    createdAt: string
    paymentMethod: PaymentMethod
    paymentStatus: string
    totals: { subtotal: number; discount: number; shipping: number; total: number }
    totalRefundedAmount: number
    sellerOrders: { sellerId: string; status: string; itemCount: number }[]
  }
  scopes: {
    order: RefundBreakdown
    sellers: { sellerId: string; breakdown: RefundBreakdown }[]
  }
  refunds: RefundRequest[]
}

/** Admin -> Finance -> Return/Refund's per-order detail: order summary,
 * an eligible-refund breakdown for the whole order and each seller's own
 * portion, and the full refund history/audit trail. */
export async function fetchRefundDetail(orderId: string): Promise<{ ok: true; data: RefundDetail } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/orders/${orderId}/refund`, { headers })
  return parseResult<RefundDetail>(response)
}

export interface SubmitRefundInput {
  sellerId?: string
  mode: "full" | "manual"
  amount?: number
  reason?: string
}

/** Creates and (for a prepaid order) immediately processes one refund —
 * see lib/refund-service.ts's createRefundRequest for the full lifecycle. */
export async function submitRefund(
  orderId: string,
  input: SubmitRefundInput,
): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  })
  const result = await parseResult<{ ok: true; refund: RefundRequest }>(response)
  if (!result.ok) return result
  return { ok: true, refund: result.data.refund }
}

/** Finance Admin's manual completion of a COD refund record (no live
 * gateway exists to confirm cash the courier collected). */
export async function decideRefund(
  orderId: string,
  refundId: string,
  decision: "Refunded" | "Failed" | "Rejected",
  note?: string,
): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/orders/${orderId}/refund/${refundId}/decision`, {
    method: "POST",
    headers,
    body: JSON.stringify({ decision, note }),
  })
  const result = await parseResult<{ ok: true; refund: RefundRequest }>(response)
  if (!result.ok) return result
  return { ok: true, refund: result.data.refund }
}

/** Admin "Sync Tracking" — live-pulls the current status from whichever
 * shipping provider auto-shipped this seller's portion of the order. */
export async function syncAdminOrderTracking(
  orderId: string,
  sellerId: string,
): Promise<{ ok: true; rawStatus: string; changed: boolean; status?: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/orders/${orderId}/track`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sellerId }),
  })
  const result = await parseResult<{ rawStatus: string; changed: boolean; status?: string }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

/** For /admin/refunds — "payments"-permission reachable (unlike fetchOrders
 * above, which requires order_management), scoped to just Paid/Refunded. */
export async function fetchRefundableOrders(
  params: { paymentStatus?: "Paid" | "Refunded"; cursor?: string | null } = {},
): Promise<{ ok: true; orders: Order[]; nextCursor: string | null; hasMore: boolean } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus)
  if (params.cursor) query.set("cursor", params.cursor)

  const response = await fetch(`/api/admin/refunds?${query.toString()}`, { headers })
  const result = await parseResult<{ orders: Order[]; nextCursor: string | null; hasMore: boolean }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}
