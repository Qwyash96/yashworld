import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { UserProfile } from "@/types/user"

const PAGE_SIZE = 25

/**
 * Paginated (cursor-based), filterable, searchable Buyers list.
 * Search is a prefix match on email (Firestore has no substring search) —
 * when searching, results are ordered by email instead of createdAt, since
 * a range filter's field must be the first orderBy.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "user_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const search = searchParams.get("search")?.trim().toLowerCase()
  const cursor = searchParams.get("cursor")

  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("users").where("role", "==", "buyer")

  if (status) query = query.where("status", "==", status)

  if (search) {
    query = query
      .where("email", ">=", search)
      .where("email", "<=", search + "")
      .orderBy("email", "asc")
  } else {
    query = query.orderBy("createdAt", "desc")
  }

  if (cursor) query = query.startAfter(cursor)

  const snap = await query.limit(PAGE_SIZE).get()
  const users = snap.docs.map((d) => d.data() as UserProfile)
  const lastDoc = snap.docs[snap.docs.length - 1]
  const nextCursor = lastDoc ? (search ? lastDoc.data().email : lastDoc.data().createdAt) : null

  return NextResponse.json({ users, nextCursor, hasMore: snap.docs.length === PAGE_SIZE })
}
