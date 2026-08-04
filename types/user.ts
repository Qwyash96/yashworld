export type UserRole =
  | "buyer"
  | "seller"
  | "super_admin"
  | "admin"
  | "operations"
  | "catalog_manager"
  | "support"
  | "finance"
  | "marketing"

export interface Address {
  id: string
  fullName: string
  line1: string
  line2?: string
  landmark?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  isDefault: boolean
}

/**
 * Firestore `users/{uid}` document shape — a profile record, separate from
 * the Firebase Auth user itself (see services/auth.service.ts).
 */
export interface UserProfile {
  uid: string
  name: string
  email: string
  role: UserRole
  addresses: Address[]
  createdAt: string
  // Admin/staff-only fields — present when role is one of the admin roles.
  department?: string
  mobile?: string
  status?: "active" | "suspended" | "banned"
  /** Admin-attestation flags set via the Users module's Verify actions — not automated OTP verification. */
  emailVerified?: boolean
  phoneVerified?: boolean
  /** Set by services/user.service.ts's ensureUserProfile() on every login, not just the first. */
  lastLoginAt?: string
  /** The last time this admin marked their notification bell as read — see types/notification.ts. */
  notificationsReadAt?: string
  /** Same idea, separate timestamp — a seller's own order-fulfillment
   * notification bell (types/seller-notification.ts). Kept distinct from
   * notificationsReadAt so a user who is both an approved seller and staff
   * doesn't have one bell's "mark read" silently clear the other's. */
  sellerNotificationsReadAt?: string
}

export type UserProfileInput = Omit<UserProfile, "createdAt">
