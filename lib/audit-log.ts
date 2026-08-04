import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { AuditLogEntryInput } from "@/types/audit-log"

/**
 * Writes one auditLogs/{id} entry — call from the end of every mutating
 * app/api/admin/**\/route.ts handler, after the mutation succeeds. Never
 * throws into the caller (a logging failure should never fail the actual
 * admin action) — logs to the server console instead.
 */
export async function writeAuditLog(entry: AuditLogEntryInput): Promise<void> {
  try {
    await getAdminDb()
      .collection("auditLogs")
      .add({ ...entry, createdAt: new Date().toISOString() })
  } catch (error) {
    console.error("[audit-log] failed to write entry:", entry.action, error)
  }
}
