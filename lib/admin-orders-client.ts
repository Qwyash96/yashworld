import { auth } from "@/services/firebase/client"
import type { Order } from "@/types/order"

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

export async function refundOrder(orderId: string, sellerId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sellerId }),
  })
  return parseResult<{ ok: true }>(response)
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
