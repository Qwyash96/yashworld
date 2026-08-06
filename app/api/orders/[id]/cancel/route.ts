import { NextResponse, type NextRequest } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { cancelShipment as cancelShipmentCommon } from "@/lib/shipping-service"
import { buildTransitionedSellerOrder, notifySellerOrderTransition } from "@/lib/order-status-transition"
import { isCancellable } from "@/types/order-lifecycle"
import type { Order, SellerOrder } from "@/types/order"
import type { AdminNotificationInput } from "@/types/notification"

type RouteContext = { params: Promise<{ id: string }> }

interface CancelBody {
  sellerId?: string
  reason?: string
}

/**
 * The buyer's own self-serve cancel — the one path where the caller isn't a
 * seller (app/api/seller/orders/[id]/status) or an admin
 * (app/api/admin/orders/[id]/refund) but the order's own buyer. Reuses
 * buildTransitionedSellerOrder for the same isCancellable-gated, timeline-
 * appending write those routes use, so a buyer can never cancel a
 * seller-order past the point a seller could (once a courier has physically
 * picked it up). Only ever touches the caller's own order (buyerId check)
 * and only ever writes status/timeline/cancellation fields — never
 * commissionAmount/payoutAmount.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const db = getAdminDb()

  const body = (await request.json().catch(() => ({}))) as CancelBody
  const reason = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: "A cancellation reason is required." }, { status: 400 })
  }
  if (!body.sellerId) {
    return NextResponse.json({ error: "sellerId is required." }, { status: 400 })
  }

  let cancelledSellerOrder: SellerOrder | null = null
  let refundNowPending = false

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error("Order not found.")
      const order = snap.data() as Order

      if (order.buyerId !== auth.uid) {
        throw new Error("You don't have permission to cancel this order.")
      }

      const index = order.sellerOrders.findIndex((so) => so.sellerId === body.sellerId)
      if (index === -1) throw new Error("That seller has no items on this order.")
      const sellerOrder = order.sellerOrders[index]

      if (!isCancellable(sellerOrder.status)) {
        throw new Error(`This order can no longer be cancelled — it is already "${sellerOrder.status}".`)
      }

      // Any gateway (not just Razorpay) — order.paymentMethod is a
      // PaymentGatewayId for every prepaid order since the multi-gateway
      // refactor, "cod" being the only non-gateway value.
      refundNowPending = order.paymentMethod !== "cod" && order.paymentStatus === "Paid"

      const updatedSellerOrder: SellerOrder = {
        ...buildTransitionedSellerOrder(sellerOrder, "Cancelled", { reason }),
        cancelledBy: "buyer",
        cancellationReason: reason,
        ...(refundNowPending ? { refundStatus: "Pending" as const } : {}),
      }

      const sellerOrders = [...order.sellerOrders]
      sellerOrders[index] = updatedSellerOrder
      cancelledSellerOrder = updatedSellerOrder

      // Restore stock for every item this seller-order was holding.
      for (const item of sellerOrder.items) {
        tx.update(db.collection("products").doc(item.productId), {
          stock: FieldValue.increment(item.quantity),
        })
      }

      const allCancelled = sellerOrders.every((so) => so.status === "Cancelled")
      tx.update(orderRef, {
        sellerOrders,
        ...(allCancelled ? { status: "Cancelled" as const } : {}),
      })
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order." },
      { status: 400 },
    )
  }

  if (!cancelledSellerOrder) {
    return NextResponse.json({ error: "Failed to cancel order." }, { status: 500 })
  }
  const cancelled: SellerOrder = cancelledSellerOrder

  // Best-effort: if a real shipment was already created with a courier,
  // attempt to cancel it there too. Never blocks the cancellation itself —
  // by the time a buyer can even see this button the package may already be
  // out of the seller's hands from the courier's perspective, and Amazon/
  // Flipkart-style cancel still succeeds locally in that case, just flags it
  // for manual follow-up.
  if (cancelled.shippingProvider && cancelled.providerShipmentId) {
    try {
      await cancelShipmentCommon(cancelled.shippingProvider, cancelled.providerShipmentId)
    } catch (error) {
      console.error("[order-cancel] failed to cancel shipment with provider:", error)
    }
  }

  await notifySellerOrderTransition(body.sellerId, orderId, "Cancelled")

  const adminNotification: AdminNotificationInput = {
    type: "order_cancelled",
    targetPermission: "order_management",
    title: "Order cancelled by buyer",
    message: `Order #${orderId.slice(0, 8)} was cancelled by the buyer. Reason: ${reason}`,
    relatedType: "order",
    relatedId: orderId,
  }
  await db.collection("notifications").add({ ...adminNotification, createdAt: new Date().toISOString() })

  return NextResponse.json({ ok: true, refundPending: refundNowPending })
}
