import "server-only"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable, isReturnable } from "@/types/order-lifecycle"
import { writeSellerNotification } from "@/lib/seller-notifications"
import type { OrderStatus, SellerOrder } from "@/types/order"
import type { SellerNotificationType } from "@/types/seller-notification"

/**
 * Single source of truth for "is this a legal fulfilment transition" and the
 * resulting write shape — shared by app/api/seller/orders/[id]/status (a
 * seller's manual click) and app/api/seller/orders/[id]/track (a live
 * Shiprocket status pull), so a courier-driven update can never apply a
 * transition a manual one couldn't.
 */
export function isAllowedOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "Cancelled") return isCancellable(from)
  if (to === "Returned") return isReturnable(from)
  const fromIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(from)
  const toIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(to)
  return fromIndex !== -1 && toIndex === fromIndex + 1
}

export interface SellerOrderTransitionExtra {
  reason?: string
  courierPartner?: string
  pickupDate?: string
  pickupTime?: string
  trackingNumber?: string
}

/** Throws if `nextStatus` isn't a legal transition from `sellerOrder.status`. */
export function buildTransitionedSellerOrder(
  sellerOrder: SellerOrder,
  nextStatus: OrderStatus,
  extra: SellerOrderTransitionExtra = {},
): SellerOrder {
  if (!isAllowedOrderTransition(sellerOrder.status, nextStatus)) {
    throw new Error(`Cannot move an order from "${sellerOrder.status}" to "${nextStatus}".`)
  }

  const now = new Date().toISOString()
  const reason = extra.reason?.trim()

  return {
    ...sellerOrder,
    status: nextStatus,
    timeline: [...(sellerOrder.timeline ?? []), { status: nextStatus, at: now, ...(reason ? { note: reason } : {}) }],
    ...(nextStatus === "Delivered" ? { deliveredAt: now, payoutStatus: "Hold" as const } : {}),
    ...(nextStatus === "Returned" ? { returnedAt: now } : {}),
    ...(nextStatus === "Cancelled" ? { cancelledAt: now, ...(reason ? { rejectionReason: reason } : {}) } : {}),
    ...(nextStatus === "Pickup Requested"
      ? {
          ...(extra.courierPartner?.trim() ? { courierPartner: extra.courierPartner.trim() } : {}),
          ...(extra.pickupDate ? { pickupDate: extra.pickupDate } : {}),
          ...(extra.pickupTime ? { pickupTime: extra.pickupTime } : {}),
          ...(extra.trackingNumber?.trim() ? { trackingNumber: extra.trackingNumber.trim() } : {}),
        }
      : {}),
    ...(nextStatus === "Picked Up" && extra.trackingNumber?.trim() ? { trackingNumber: extra.trackingNumber.trim() } : {}),
  }
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

/** Fire-and-await after the transition's transaction has committed. No-op for statuses with no notification (e.g. "In Transit"). */
export async function notifySellerOrderTransition(sellerId: string, orderId: string, nextStatus: OrderStatus): Promise<void> {
  const notify = NOTIFY[nextStatus]
  if (!notify) return
  await writeSellerNotification({
    sellerId,
    type: notify.type,
    title: notify.title,
    message: notify.message(orderId),
    relatedType: "order",
    relatedId: orderId,
  })
}
