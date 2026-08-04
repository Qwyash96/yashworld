import type { AdminPermission } from "@/lib/admin-roles"

export type NotificationType =
  | "buyer_registered"
  | "seller_application_submitted"
  | "order_placed"
  | "payment_received"
  | "refund_issued"
  | "withdrawal_requested"
  | "support_ticket_created"

/**
 * Firestore `notifications/{id}` — an admin alert feed. `targetPermission`
 * decides which roles' bell it appears in (a viewer sees a notification iff
 * their role hasPermission(targetPermission)) — see
 * components/admin/admin-notification-bell.tsx.
 *
 * Unread state is tracked without a fan-out write per admin per event: a
 * notification is "unread" for a viewer if its createdAt is after that
 * viewer's own UserProfile.notificationsReadAt (types/user.ts).
 */
export interface AdminNotification {
  id: string
  type: NotificationType
  targetPermission: AdminPermission
  title: string
  message: string
  relatedType: string
  relatedId: string
  createdAt: string
}

export type AdminNotificationInput = Omit<AdminNotification, "id" | "createdAt">
