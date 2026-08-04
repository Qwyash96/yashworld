export type TicketStatus = "new" | "open" | "in_progress" | "resolved" | "closed"

/** Firestore `supportTickets/{id}` document shape. */
export interface SupportTicket {
  id: string
  sellerId?: string
  buyerId?: string
  sellerName: string
  mobile: string
  subject: string
  problemType: string
  description: string
  screenshotFileName?: string
  preferredContactTime: string
  status: TicketStatus
  createdAt: string
}

export type SupportTicketInput = Omit<SupportTicket, "id" | "status" | "createdAt">
