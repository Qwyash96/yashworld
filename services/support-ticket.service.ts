import { collection, doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { SupportTicket, SupportTicketInput, TicketStatus } from "@/types/support-ticket"
import type { AdminNotificationInput } from "@/types/notification"

const COLLECTION = "supportTickets"

export async function createSupportTicket(input: SupportTicketInput): Promise<string> {
  try {
    const now = new Date().toISOString()
    const ticketRef = doc(collection(db, COLLECTION))

    // Whichever of buyerId/sellerId is set must equal the caller's own uid
    // (enforced by firestore.rules' supportTickets create rule) — reused
    // here as the notification's relatedId, per the same rule on notifications.
    const relatedId = input.buyerId ?? input.sellerId
    const notification: AdminNotificationInput = {
      type: "support_ticket_created",
      targetPermission: "support",
      title: "New support ticket",
      message: `${input.sellerName} — ${input.subject}`,
      relatedType: "supportTicket",
      relatedId: relatedId ?? "",
    }

    const batch = writeBatch(db)
    batch.set(ticketRef, { ...input, status: "new" as TicketStatus, createdAt: now })
    batch.set(doc(collection(db, "notifications")), { ...notification, createdAt: now })
    await batch.commit()

    return ticketRef.id
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
