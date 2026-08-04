import type { AdminRole } from "@/lib/admin-roles"

/**
 * Firestore `auditLogs/{id}` — one entry per admin mutation, written via
 * lib/audit-log.ts's writeAuditLog() from inside the mutating API route,
 * after the mutation succeeds. Admin-SDK-write-only (see firestore.rules).
 *
 * `action` is a free-form dotted string ("seller.approve", "staff.invite",
 * "coupon.delete", ...) rather than a closed union — new admin actions
 * shouldn't require a type-union edit here.
 */
export interface AuditLogEntry {
  id: string
  actorUid: string
  actorEmail: string
  actorRole: AdminRole
  action: string
  targetType: string
  targetId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  createdAt: string
}

export type AuditLogEntryInput = Omit<AuditLogEntry, "id" | "createdAt">
