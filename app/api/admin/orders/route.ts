import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"

const PAGE_SIZE = 25

/** Paginated (cursor-based), filterable Orders list. Search is a prefix
 * match on contactEmail (Firestore has no substring search). */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "order_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const paymentStatus = searchParams.get("paymentStatus")
  const search = searchParams.get("search")?.trim().toLowerCase()
  const cursor = searchParams.get("cursor")

  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("orders")

  if (status) query = query.where("status", "==", status)
  if (paymentStatus) query = query.where("paymentStatus", "==", paymentStatus)

  if (search) {
    query = query
      .where("contactEmail", ">=", search)
      .where("contactEmail", "<=", search + "")
      .orderBy("contactEmail", "asc")
  } else {
    query = query.orderBy("createdAt", "desc")
  }

  if (cursor) query = query.startAfter(cursor)

  const snap = await query.limit(PAGE_SIZE).get()
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  const lastDoc = snap.docs[snap.docs.length - 1]
  const nextCursor = lastDoc ? (search ? lastDoc.data().contactEmail : lastDoc.data().createdAt) : null

  return NextResponse.json({ orders, nextCursor, hasMore: snap.docs.length === PAGE_SIZE })
}
