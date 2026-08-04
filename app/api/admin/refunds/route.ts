import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order, PaymentStatus } from "@/types/order"

const PAGE_SIZE = 25

/** Orders eligible for or already touched by a refund — "Paid" (refundable)
 * and "Refunded" (history), platform-wide. The only other UI for this data
 * (app/admin/orders/[id]) is gated by order_management, which finance never
 * holds; this route is gated on "payments" to match app/api/admin/orders/
 * [id]/refund, the route it exists to feed a reachable list for. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const paymentStatus = (searchParams.get("paymentStatus") as PaymentStatus | null) ?? "Paid"
  const cursor = searchParams.get("cursor")

  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("orders").where("paymentStatus", "==", paymentStatus).orderBy("createdAt", "desc")
  if (cursor) query = query.startAfter(cursor)

  const snap = await query.limit(PAGE_SIZE).get()
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  const lastDoc = snap.docs[snap.docs.length - 1]

  return NextResponse.json({
    orders,
    nextCursor: lastDoc ? lastDoc.data().createdAt : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  })
}
