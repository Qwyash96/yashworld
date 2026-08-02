import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Order, OrderInput, OrderStatus } from "@/types/order"

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
    const q = query(collection(db, COLLECTION), where("buyerId", "==", buyerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  } catch (error) {
    throw toServiceError(`Failed to fetch orders for buyer "${buyerId}"`, error)
  }
}

export async function createOrder(input: OrderInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...input,
      createdAt: new Date().toISOString(),
    })
    return docRef.id
  } catch (error) {
    throw toServiceError("Failed to create order", error)
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { status })
  } catch (error) {
    throw toServiceError(`Failed to update order status "${id}"`, error)
  }
}
