export type UserRole = "buyer" | "seller" | "admin"

export interface Address {
  id: string
  fullName: string
  line1: string
  line2?: string
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
}

export type UserProfileInput = Omit<UserProfile, "createdAt">
