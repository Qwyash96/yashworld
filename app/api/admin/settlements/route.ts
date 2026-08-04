import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"

const PAGE_SIZE = 25

/**
 * "Settlements" = every gateway-captured payment (paymentMethod == "razorpay"
 * && paymentStatus == "Paid"), platform-wide — the real, non-fabricated data
 * this app actually has. True bank-settlement timing/UTR reference numbers
 * require Razorpay's own Settlements API (a separate, not-yet-integrated
 * reconciliation call, distinct from the order-capture data available here);
 * the client page says so plainly rather than inventing settlement dates.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db
      .collection("orders")
      .where("paymentMethod", "==", "razorpay")
      .where("paymentStatus", "==", "Paid")
      .orderBy("createdAt", "desc")
    if (cursor) query = query.startAfter(cursor)

    const snap = await query.limit(PAGE_SIZE).get()
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
    const lastDoc = snap.docs[snap.docs.length - 1]

    const totalCaptured = orders.reduce((sum, o) => sum + o.totals.total, 0)

    return NextResponse.json({
      orders,
      totalCaptured,
      nextCursor: lastDoc ? lastDoc.data().createdAt : null,
      hasMore: snap.docs.length === PAGE_SIZE,
    })
  } catch (error) {
    console.error("[admin/settlements] failed:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load settlements." }, { status: 500 })
  }
}
