export type SellerNotificationType =
  | "new_order"
  | "pickup_scheduled"
  | "pickup_completed"
  | "order_delivered"
  | "order_returned"
  | "order_cancelled"
  | "payment_settled"

/**
 * Firestore `sellerNotifications/{id}` — a seller-facing alert feed, targeted
 * by uid (unlike notifications/{id}, which targets admin roles by
 * permission — see types/notification.ts). Unread state follows the same
 * pattern: unread iff createdAt is after the seller's own
 * UserProfile.sellerNotificationsReadAt (types/user.ts) — a separate
 * timestamp from the admin bell's, so a user who is both staff and an
 * approved seller doesn't have one bell's "mark read" clear the other's.
 */
export interface SellerNotification {
  id: string
  sellerId: string
  type: SellerNotificationType
  title: string
  message: string
  relatedType: string
  relatedId: string
  createdAt: string
}

export type SellerNotificationInput = Omit<SellerNotification, "id" | "createdAt">
