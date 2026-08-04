import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { Order } from "@/types/order"
import type { AdminNotificationInput } from "@/types/notification"

type RouteContext = { params: Promise<{ id: string }> }

interface RefundBody {
  sellerId?: string
}

/**
 * Deliberately minimal — sets paymentStatus/the targeted sellerOrder.status
 * to "Refunded" and logs it. Does not implement the full
 * ReturnRequestRecord/DisputeRecord buyer-initiated-return workflow already
 * sketched (unused) in types/order-lifecycle.ts — that's a materially
 * larger, separate feature.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("orders").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as RefundBody
  const order = snap.data() as Order

  const sellerOrders = body.sellerId
    ? order.sellerOrders.map((so) => (so.sellerId === body.sellerId ? { ...so, status: "Refunded" as const } : so))
    : order.sellerOrders.map((so) => ({ ...so, status: "Refunded" as const }))

  await ref.update({ paymentStatus: "Refunded", sellerOrders })

  const notification: AdminNotificationInput = {
    type: "refund_issued",
    targetPermission: "payments",
    title: "Refund issued",
    message: `Order #${id.slice(0, 8)} was refunded${body.sellerId ? " (one seller)" : ""}.`,
    relatedType: "order",
    relatedId: id,
  }
  await db.collection("notifications").add({ ...notification, createdAt: new Date().toISOString() })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "order.refund",
    targetType: "order",
    targetId: id,
    after: { paymentStatus: "Refunded", sellerId: body.sellerId },
  })

  return NextResponse.json({ ok: true })
}
