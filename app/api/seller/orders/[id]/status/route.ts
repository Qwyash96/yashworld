import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable, isReturnable } from "@/types/order-lifecycle"
import { writeSellerNotification } from "@/lib/seller-notifications"
import type { Order, OrderStatus, SellerOrder } from "@/types/order"
import type { SellerNotificationType } from "@/types/seller-notification"

type RouteContext = { params: Promise<{ id: string }> }

interface StatusBody {
  status?: OrderStatus
  /** Required when rejecting/cancelling — stored as SellerOrder.rejectionReason and as the timeline note. */
  reason?: string
  /** Required exactly when transitioning to "Pickup Requested" (the Schedule Pickup action). */
  courierPartner?: string
  pickupDate?: string
  pickupTime?: string
  trackingNumber?: string
}

function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "Cancelled") return isCancellable(from)
  if (to === "Returned") return isReturnable(from)
  const fromIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(from)
  const toIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(to)
  return fromIndex !== -1 && toIndex === fromIndex + 1
}

const NOTIFY: Partial<Record<OrderStatus, { type: SellerNotificationType; title: string; message: (orderId: string) => string }>> = {
  "Pickup Requested": {
    type: "pickup_scheduled",
    title: "Pickup scheduled",
    message: (id) => `Pickup scheduled for order #${id.slice(0, 8)}.`,
  },
  "Picked Up": {
    type: "pickup_completed",
    title: "Pickup completed",
    message: (id) => `Order #${id.slice(0, 8)} was picked up by the courier.`,
  },
  Delivered: {
    type: "order_delivered",
    title: "Order delivered",
    message: (id) => `Order #${id.slice(0, 8)} was delivered.`,
  },
  Returned: {
    type: "order_returned",
    title: "Order returned",
    message: (id) => `Order #${id.slice(0, 8)} was marked returned.`,
  },
  Cancelled: {
    type: "order_cancelled",
    title: "Order cancelled",
    message: (id) => `Order #${id.slice(0, 8)} was cancelled.`,
  },
}

/**
 * The one trusted path for a seller to progress their portion of an order —
 * covers every fulfillment action (Accept/Reject, Mark Packed, Schedule
 * Pickup, Handed To Courier, advance to In Transit/Out For Delivery/
 * Delivered, Mark Returned, Cancel) through the same transition-validated,
 * timeline-appending write. Firestore rules don't let a seller write
 * orders/{id} directly (that let them rewrite the WHOLE sellerOrders array,
 * including commissionAmount/payoutAmount — harmless before a real wallet
 * existed, not harmless once one reads that field as real money). This
 * route only ever changes status/timeline/courier/rejection fields —
 * commissionAmount/payoutAmount are read from the stored sellerOrder and
 * written back unchanged, never accepted from the request body.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApprovedSeller(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const db = getAdminDb()

  const body = (await request.json().catch(() => ({}))) as StatusBody
  if (!body.status) {
    return NextResponse.json({ error: "A status is required." }, { status: 400 })
  }
  const nextStatus = body.status

  if (nextStatus === "Pickup Requested" && !body.courierPartner?.trim()) {
    return NextResponse.json({ error: "Courier partner is required to schedule a pickup." }, { status: 400 })
  }
  if (nextStatus === "Cancelled" && !body.reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject/cancel an order." }, { status: 400 })
  }

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error("Order not found.")
      const order = snap.data() as Order

      const index = order.sellerOrders.findIndex((so) => so.sellerId === auth.uid)
      if (index === -1) throw new Error("You don't have any items on this order.")
      const sellerOrder = order.sellerOrders[index]

      if (!isAllowedTransition(sellerOrder.status, nextStatus)) {
        throw new Error(`Cannot move an order from "${sellerOrder.status}" to "${nextStatus}".`)
      }

      const now = new Date().toISOString()
      const reason = body.reason?.trim()

      const updatedSellerOrder: SellerOrder = {
        ...sellerOrder,
        status: nextStatus,
        timeline: [...(sellerOrder.timeline ?? []), { status: nextStatus, at: now, ...(reason ? { note: reason } : {}) }],
        ...(nextStatus === "Delivered" ? { deliveredAt: now, payoutStatus: "Hold" as const } : {}),
        ...(nextStatus === "Returned" ? { returnedAt: now } : {}),
        ...(nextStatus === "Cancelled" ? { cancelledAt: now, ...(reason ? { rejectionReason: reason } : {}) } : {}),
        ...(nextStatus === "Pickup Requested"
          ? {
              courierPartner: body.courierPartner!.trim(),
              ...(body.pickupDate ? { pickupDate: body.pickupDate } : {}),
              ...(body.pickupTime ? { pickupTime: body.pickupTime } : {}),
              ...(body.trackingNumber?.trim() ? { trackingNumber: body.trackingNumber.trim() } : {}),
            }
          : {}),
        ...(nextStatus === "Picked Up" && body.trackingNumber?.trim() ? { trackingNumber: body.trackingNumber.trim() } : {}),
      }

      const sellerOrders = [...order.sellerOrders]
      sellerOrders[index] = updatedSellerOrder

      tx.update(orderRef, {
        sellerOrders,
        ...(nextStatus === "Delivered" ? { hasHeldPayouts: true } : {}),
      })
    })

    const notify = NOTIFY[nextStatus]
    if (notify) {
      await writeSellerNotification({
        sellerId: auth.uid,
        type: notify.type,
        title: notify.title,
        message: notify.message(orderId),
        relatedType: "order",
        relatedId: orderId,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order status." },
      { status: 400 },
    )
  }
}
