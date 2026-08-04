import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { SupportTicket, SupportTicketInput, TicketStatus } from "@/types/support-ticket"

const COLLECTION = "supportTickets"

export async function createSupportTicket(input: SupportTicketInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...input,
      status: "new" as TicketStatus,
      createdAt: new Date().toISOString(),
    })
    return docRef.id
  } catch (error) {
    throw toServiceError("Failed to submit support ticket", error)
  }
}

/** Admin: every ticket, newest first. */
export async function getAllSupportTickets(): Promise<SupportTicket[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket)
  } catch (error) {
    throw toServiceError("Failed to fetch support tickets", error)
  }
}

export async function getTicketsByBuyer(buyerId: string): Promise<SupportTicket[]> {
  try {
    const q = query(collection(db, COLLECTION), where("buyerId", "==", buyerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket)
  } catch (error) {
    throw toServiceError(`Failed to fetch support tickets for buyer "${buyerId}"`, error)
  }
}

/** Admin action. */
export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { status })
  } catch (error) {
    throw toServiceError(`Failed to update ticket "${id}"`, error)
  }
}
