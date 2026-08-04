import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { AuditLogEntry } from "@/types/audit-log"

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const actorUid = searchParams.get("actorUid")
  const targetType = searchParams.get("targetType")
  const cursor = searchParams.get("cursor")

  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("auditLogs")

  if (actorUid) {
    query = query.where("actorUid", "==", actorUid).orderBy("createdAt", "desc")
  } else if (targetType) {
    query = query.where("targetType", "==", targetType).orderBy("createdAt", "desc")
  } else {
    query = query.orderBy("createdAt", "desc")
  }

  if (cursor) query = query.startAfter(cursor)

  const snap = await query.limit(PAGE_SIZE).get()
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry)
  const lastDoc = snap.docs[snap.docs.length - 1]

  return NextResponse.json({
    entries,
    nextCursor: lastDoc ? lastDoc.data().createdAt : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  })
}
