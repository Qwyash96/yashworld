import type { UserRole } from "@/types/user"

/**
 * Firestore `presence/{uid}` — one document per signed-in user (buyer,
 * seller, or admin), heartbeat-updated by hooks/use-presence-heartbeat.ts
 * every ~25s while any page is open. Powers the admin dashboard's "Online
 * Users" (live, last few minutes) and "Active Users" (one-shot count,
 * today) tiles.
 */
export interface Presence {
  uid: string
  role: UserRole
  lastSeenAt: string
  currentPath?: string
}
