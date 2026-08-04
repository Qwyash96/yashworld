import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { IntegrationCategory } from "@/types/integrations"

export interface IntegrationLogEntry {
  id: string
  providerId: string
  category: IntegrationCategory
  level: "info" | "error"
  type: "verify" | "test" | "webhook" | "api_call"
  message: string
  statusCode?: number
  createdAt: string
}

/** Never throws into the caller — a logging failure should never fail the actual admin action. */
export async function writeIntegrationLog(entry: Omit<IntegrationLogEntry, "id" | "createdAt">): Promise<void> {
  try {
    await getAdminDb()
      .collection("integrationLogs")
      .add({ ...entry, createdAt: new Date().toISOString() })
  } catch (error) {
    console.error("[integration-log] failed to write entry:", entry.providerId, error)
  }
}

const PAGE_SIZE = 50

export async function listIntegrationLogs(
  providerId: string,
  opts: { level?: "info" | "error"; cursor?: string | null },
): Promise<{ entries: IntegrationLogEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("integrationLogs").where("providerId", "==", providerId)
  if (opts.level) query = query.where("level", "==", opts.level)
  query = query.orderBy("createdAt", "desc")
  if (opts.cursor) query = query.startAfter(opts.cursor)

  const snapshot = await query.limit(PAGE_SIZE).get()
  const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as IntegrationLogEntry)
  const lastDoc = snapshot.docs[snapshot.docs.length - 1]

  return {
    entries,
    nextCursor: lastDoc ? lastDoc.data().createdAt : null,
    hasMore: snapshot.docs.length === PAGE_SIZE,
  }
}
