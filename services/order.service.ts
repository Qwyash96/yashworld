import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
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

/** Seller action: updates only their own entry within sellerOrders. */
export async function updateSellerOrderStatus(
  orderId: string,
  sellerId: string,
  status: OrderStatus,
): Promise<void> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, orderId))
    if (!snapshot.exists()) throw new Error("Order not found")
    const order = snapshot.data() as Order
    const sellerOrders = order.sellerOrders.map((so) =>
      so.sellerId === sellerId ? { ...so, status } : so,
    )
    await updateDoc(doc(db, COLLECTION, orderId), { sellerOrders })
  } catch (error) {
    throw toServiceError(`Failed to update seller order status for order "${orderId}"`, error)
  }
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
