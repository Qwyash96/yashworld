import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import { getDecryptedCredentials } from "@/lib/integrations/config-store"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import type { Order } from "@/types/order"
import type { AdminNotificationInput } from "@/types/notification"

type RouteContext = { params: Promise<{ id: string }> }

interface RefundBody {
  sellerId?: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Sets paymentStatus/the targeted sellerOrder.status to "Refunded" AND —
 * for a Razorpay order — actually returns the buyer's money via Razorpay's
 * refund API first. Previously this only flipped the Firestore flag with no
 * gateway call at all, so clicking "Refund" never sent the buyer anything;
 * the order just looked refunded in the admin UI. The gateway call happens
 * BEFORE any Firestore write so a failed refund never leaves the database
 * claiming money moved when it didn't.
 *
 * A sellerId scopes the refund to one seller's items on a multi-seller
 * order — that seller's own item total (what the buyer paid for exactly
 * those items, already post-discount), not the whole order. Omitting it
 * refunds the full order total. Shipping is not refunded on a partial,
 * matching typical return-policy practice.
 *
 * Does not implement the full ReturnRequestRecord/DisputeRecord
 * buyer-initiated-return workflow already sketched (unused) in
 * types/order-lifecycle.ts — that's a materially larger, separate feature.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("orders").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const order = snap.data() as Order
  if (order.paymentStatus === "Refunded") {
    return NextResponse.json({ error: "This order has already been refunded." }, { status: 409 })
  }

  const body = (await request.json().catch(() => ({}))) as RefundBody
  if (body.sellerId && !order.sellerOrders.some((so) => so.sellerId === body.sellerId)) {
    return NextResponse.json({ error: "That seller has no items on this order." }, { status: 400 })
  }

  const refundAmount = body.sellerId
    ? round2(
        order.sellerOrders
          .find((so) => so.sellerId === body.sellerId)!
          .items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      )
    : order.totals.total

  if (order.paymentMethod === "razorpay") {
    if (!order.razorpayPaymentId) {
      return NextResponse.json({ error: "This order has no Razorpay payment to refund." }, { status: 400 })
    }
    const credentials = await getDecryptedCredentials("razorpay")
    try {
      await getRazorpayClient(credentials.keyId, credentials.keySecret).payments.refund(order.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { orderId: id, ...(body.sellerId ? { sellerId: body.sellerId } : {}) },
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Razorpay refund failed." },
        { status: 502 },
      )
    }
  }
  // COD: no gateway payment was ever taken, so there's nothing to call —
  // this is a cash refund handled outside the system; only the record updates.

  const sellerOrders = body.sellerId
    ? order.sellerOrders.map((so) => (so.sellerId === body.sellerId ? { ...so, status: "Returned" as const } : so))
    : order.sellerOrders.map((so) => ({ ...so, status: "Returned" as const }))

  await ref.update({ paymentStatus: "Refunded", sellerOrders })

  const notification: AdminNotificationInput = {
    type: "refund_issued",
    targetPermission: "payments",
    title: "Refund issued",
    message: `Order #${id.slice(0, 8)} was refunded (${round2(refundAmount)})${body.sellerId ? " — one seller" : ""}.`,
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
    after: { paymentStatus: "Refunded", sellerId: body.sellerId, refundAmount },
  })

  return NextResponse.json({ ok: true, refundAmount })
}
