import { auth } from "@/services/firebase/client"
import type { SellerFacingOrder } from "@/lib/seller-order-redaction"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}` }
}

/**
 * Seller order reads — go through app/api/seller/orders/** (Admin SDK)
 * instead of a direct Firestore client read, specifically so buyer
 * phone/email are redacted server-side and never reach the seller's
 * browser at all, not just hidden by the UI (see
 * lib/seller-order-redaction.ts). Every app/seller/** page that used to
 * call services/order.service.ts's getOrdersBySeller/getOrderById directly
 * uses these instead.
 */
export async function fetchMySellerOrders(): Promise<SellerFacingOrder[]> {
  const headers = await authHeaders()
  const response = await fetch("/api/seller/orders", { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "Failed to fetch orders.")
  return body.orders as SellerFacingOrder[]
}

export async function fetchMySellerOrder(id: string): Promise<SellerFacingOrder | null> {
  const headers = await authHeaders()
  const response = await fetch(`/api/seller/orders/${id}`, { headers })
  if (response.status === 404) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "Failed to fetch order.")
  return body.order as SellerFacingOrder
}
