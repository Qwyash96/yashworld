import { auth } from "@/services/firebase/client"
import type { AuditLogEntry } from "@/types/audit-log"

export interface FetchAuditLogsParams {
  actorUid?: string
  targetType?: string
  cursor?: string | null
}

export async function fetchAuditLogs(
  params: FetchAuditLogsParams,
): Promise<{ ok: true; entries: AuditLogEntry[]; nextCursor: string | null; hasMore: boolean } | { ok: false; error: string }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const query = new URLSearchParams()
  if (params.actorUid) query.set("actorUid", params.actorUid)
  if (params.targetType) query.set("targetType", params.targetType)
  if (params.cursor) query.set("cursor", params.cursor)

  const response = await fetch(`/api/admin/audit-logs?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Failed to load audit logs." }
  return { ok: true, ...body }
}
