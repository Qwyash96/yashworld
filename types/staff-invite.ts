import type { AdminRole } from "@/lib/admin-roles"

export type StaffInviteStatus = "pending" | "consumed"

/** Firestore `staffInvites/{email}` — doc ID is the lowercased invited email.
 * Admin-SDK-only; consumed automatically on the invited email's first Google
 * sign-in (see app/api/auth/bootstrap-profile/route.ts). */
export interface StaffInvite {
  email: string
  role: AdminRole
  mobile?: string
  department?: string
  invitedBy: string
  invitedAt: string
  status: StaffInviteStatus
  consumedAt?: string
  consumedUid?: string
}
