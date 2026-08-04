/**
 * Firestore `loginHistory/{id}` — one entry per successful sign-in, written
 * by app/api/auth/record-login/route.ts, called from
 * services/user.service.ts's ensureUserProfile() on every login (not just
 * the first one).
 */
export interface LoginHistoryEntry {
  id: string
  uid: string
  at: string
  method: "google"
  userAgent?: string
}
