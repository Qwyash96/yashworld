import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore"
import { auth, db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Order, OrderStatus, PaymentStatus } from "@/types/order"

const COLLECTION = "orders"

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, id))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() } as Order
  } catch (error) {
    throw toServiceError(`Failed to fetch order "${id}"`, error)
  }
}

export async function getOrdersByBuyer(buyerId: string): Promise<Order[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc"),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  } catch (error) {
    throw toServiceError(`Failed to fetch orders for buyer "${buyerId}"`, error)
  }
}

/** For the seller order queue. Matches the orders composite index (sellerIds contains + createdAt). */
export async function getOrdersBySeller(sellerId: string): Promise<Order[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("sellerIds", "array-contains", sellerId),
      orderBy("createdAt", "desc"),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  } catch (error) {
    throw toServiceError(`Failed to fetch orders for seller "${sellerId}"`, error)
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { status })
  } catch (error) {
    throw toServiceError(`Failed to update order status "${id}"`, error)
  }
}

export interface SellerOrderStatusUpdate {
  status: OrderStatus
  /** Required to reject a Pending order or cancel any cancellable order. */
  reason?: string
}

export type SellerOrderStatusUpdateResult = {
  shipment?: { ok: true; courierPartner: string } | { ok: false; error: string }
}

/**
 * Seller action: updates only their own entry within sellerOrders. Now
 * covers only Accept/Reject, Cancel, and Mark Returned — every later
 * fulfilment stage (shipment creation, pickup, in-transit, delivered) is
 * driven automatically by the shipping provider once the seller accepts
 * (see app/api/seller/orders/[id]/status's SELLER_POSTABLE_STATUSES). Goes
 * through that route (Admin SDK) rather than a direct Firestore write —
 * firestore.rules no longer lets a seller write orders/{id} at all, since a
 * direct write let them rewrite the whole sellerOrders array including
 * commissionAmount/payoutAmount. The route derives the caller's own
 * sellerId from their auth token; the `sellerId` parameter here is kept
 * only so existing call sites don't need to change. Posting `status:
 * "Accepted"` again while the order is already "Accepted" retries shipment
 * creation after a previous shippingSetupError, rather than being rejected
 * as an illegal transition — see the route's `isRetry` handling.
 */
export async function updateSellerOrderStatus(
  orderId: string,
  _sellerId: string,
  update: OrderStatus | SellerOrderStatusUpdate,
): Promise<SellerOrderStatusUpdateResult> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const body = typeof update === "string" ? { status: update } : update

  const response = await fetch(`/api/seller/orders/${orderId}/status`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const responseBody = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(responseBody.error ?? `Failed to update seller order status for order "${orderId}"`)
  }
  return responseBody
}

/** Live-pulls the AWB's current status from Shiprocket and advances the
 * seller order through the fulfilment sequence if it's moved — see
 * app/api/seller/orders/[id]/track's doc comment for why this is a pull
 * button rather than a passive webhook. */
export async function syncSellerOrderTracking(
  orderId: string,
): Promise<{ rawStatus: string; changed: boolean; status?: OrderStatus }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const response = await fetch(`/api/seller/orders/${orderId}/track`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? `Failed to sync tracking for order "${orderId}"`)
  }
  return body
}

/** A seller's own private note on their portion of the order — never seen
 * by the buyer. Pass an empty string to clear it. */
export async function updateSellerOrderNote(orderId: string, note: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const response = await fetch(`/api/seller/orders/${orderId}/note`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to save note for order "${orderId}"`)
  }
}

/**
 * Buyer self-serve cancel — goes through app/api/orders/[id]/cancel (Admin
 * SDK), never a direct Firestore write (firestore.rules only lets a buyer
 * read their own order, not update it). `sellerId` scopes which seller's
 * portion to cancel, matching SellerOrder granularity; the vast majority of
 * orders have exactly one.
 */
export async function cancelOrder(
  orderId: string,
  sellerId: string,
  reason: string,
): Promise<{ refundPending: boolean }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const response = await fetch(`/api/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sellerId, reason }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? `Failed to cancel order "${orderId}"`)
  }
  return { refundPending: !!body.refundPending }
}

/** For the future Razorpay webhook — not called anywhere yet. */
export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { paymentStatus })
  } catch (error) {
    throw toServiceError(`Failed to update payment status for order "${id}"`, error)
  }
}
