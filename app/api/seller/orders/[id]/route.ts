import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { redactOrderForSeller } from "@/lib/seller-order-redaction"
import type { Order } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * A single order for the seller order-detail page — Admin SDK, redacted
 * (see lib/seller-order-redaction.ts) before the response is sent, same as
 * GET /api/seller/orders. Ownership is checked here explicitly since Admin
 * SDK reads bypass firestore.rules entirely.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApprovedSeller(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const db = getAdminDb()
  const snap = await db.collection("orders").doc(orderId).get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const order = { id: snap.id, ...snap.data() } as Order
  if (!order.sellerOrders.some((so) => so.sellerId === auth.uid)) {
    return NextResponse.json({ error: "You don't have any items on this order." }, { status: 403 })
  }

  return NextResponse.json({ order: redactOrderForSeller(order) })
}
