import "server-only"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable, isReturnable } from "@/types/order-lifecycle"
import { writeSellerNotification } from "@/lib/seller-notifications"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order, OrderStatus, SellerOrder } from "@/types/order"
import type { SellerNotificationType } from "@/types/seller-notification"
import type { AutoAwbResult } from "@/lib/shipping-service"

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
  // "Cancel Pickup" — the one deliberate backward hop, only before the
  // courier has actually taken physical custody. Reverting all the way to
  // "Packed" (not just decrementing the index) because a cancelled pickup
  // means nothing about the pack/pickup readiness has changed, only that
  // the courier assignment itself needs to be redone.
  if (from === "Pickup Requested" && to === "Packed") return true
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
  /** Required (by convention — not type-enforced here) when nextStatus is
   * "Returned" — a sequential, human-readable id minted by the caller via
   * lib/sequential-id.ts's mintSequentialId("return") BEFORE this function
   * runs, since minting is async and this function is deliberately kept
   * pure/synchronous. See app/api/seller/orders/[id]/status/route.ts. */
  returnNumber?: string
}

/** Drops the courier-assignment fields entirely (rather than setting them to
 * `undefined`, which Firestore's Admin SDK rejects in nested array values)
 * — used when a Cancel Pickup reverts the seller order back to "Packed", so
 * a stale AWB/courier name never lingers past the pickup it belonged to. */
function withoutCourierFields(sellerOrder: SellerOrder): SellerOrder {
  const { courierPartner, trackingNumber, pickupDate, pickupTime, shippingProvider, ...rest } = sellerOrder
  void courierPartner
  void trackingNumber
  void pickupDate
  void pickupTime
  void shippingProvider
  return rest as SellerOrder
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
  const isCancelPickup = sellerOrder.status === "Pickup Requested" && nextStatus === "Packed"

  return {
    ...(isCancelPickup ? withoutCourierFields(sellerOrder) : sellerOrder),
    status: nextStatus,
    timeline: [...(sellerOrder.timeline ?? []), { status: nextStatus, at: now, ...(reason ? { note: reason } : {}) }],
    ...(nextStatus === "Delivered" ? { deliveredAt: now, payoutStatus: "Hold" as const } : {}),
    ...(nextStatus === "Returned" ? { returnedAt: now, ...(extra.returnNumber ? { returnNumber: extra.returnNumber } : {}) } : {}),
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

/**
 * System-driven jump straight to "Pickup Requested" once a real shipment
 * has actually been created by the shipping provider — used only by
 * lib/order-auto-fulfillment.ts's post-Accept flow, never exposed to a
 * seller-clickable action or accepted by app/api/seller/orders/[id]/status's
 * request body. Deliberately bypasses isAllowedOrderTransition's normal
 * one-hop-only rule: under the new provider-driven workflow nothing
 * meaningful ever happens at "Ready To Pack"/"Packed" (there's no seller
 * action left that produces those states), so writing fake intermediate
 * timeline entries for stages nobody actually performed would be exactly
 * the kind of fabricated event this workflow must avoid. Valid from
 * "Accepted", or — for backward compatibility with any order already
 * sitting at "Ready To Pack"/"Packed" from before this change shipped —
 * from either of those two as well.
 */
export function buildAutoShippedSellerOrder(sellerOrder: SellerOrder, awb: AutoAwbResult): SellerOrder {
  if (!["Accepted", "Ready To Pack", "Packed"].includes(sellerOrder.status)) {
    throw new Error(`Cannot auto-ship an order in "${sellerOrder.status}" status.`)
  }
  const now = new Date().toISOString()
  // Drop any stale failure note from a previous failed attempt — Firestore's
  // Admin SDK rejects `undefined` field values in a nested array object, so
  // this has to be an omission via destructuring, not `shippingSetupError: undefined`.
  const { shippingSetupError: _drop, ...rest } = sellerOrder
  void _drop

  return {
    ...rest,
    status: "Pickup Requested",
    timeline: [...(sellerOrder.timeline ?? []), { status: "Pickup Requested" as const, at: now, note: `Shipment created with ${awb.courierPartner}` }],
    shippingProvider: awb.shippingProvider,
    providerShipmentId: awb.providerShipmentId,
    courierPartner: awb.courierPartner,
    trackingNumber: awb.trackingNumber,
    ...(awb.pickupDate ? { pickupDate: awb.pickupDate } : {}),
    ...(awb.pickupTime ? { pickupTime: awb.pickupTime } : {}),
    ...(awb.pickupWindow ? { pickupWindow: awb.pickupWindow } : {}),
    labelStatus: awb.labelUrl ? ("ready" as const) : ("pending" as const),
    ...(awb.labelUrl ? { labelUrl: awb.labelUrl } : {}),
  }
}

const NOTIFY: Partial<Record<OrderStatus, { type: SellerNotificationType; title: string; message: (displayId: string) => string }>> = {
  "Pickup Requested": {
    type: "pickup_scheduled",
    title: "Pickup scheduled",
    message: (displayId) => `Pickup scheduled for order #${displayId}.`,
  },
  "Picked Up": {
    type: "pickup_completed",
    title: "Pickup completed",
    message: (displayId) => `Order #${displayId} was picked up by the courier.`,
  },
  Delivered: {
    type: "order_delivered",
    title: "Order delivered",
    message: (displayId) => `Order #${displayId} was delivered.`,
  },
  Returned: {
    type: "order_returned",
    title: "Order returned",
    message: (displayId) => `Order #${displayId} was marked returned.`,
  },
  Cancelled: {
    type: "order_cancelled",
    title: "Order cancelled",
    message: (displayId) => `Order #${displayId} was cancelled.`,
  },
}

/** Fire-and-await after the transition's transaction has committed. No-op
 * for statuses with no notification (e.g. "In Transit"). Does its own
 * cheap read of the order to get its real orderNumber for the message text
 * — deliberately NOT threaded through this function's 4 call sites'
 * signatures (some of which don't already have the order loaded at the
 * call point), falling back to the truncated Firestore id for an order
 * created before orderNumber existed. */
export async function notifySellerOrderTransition(sellerId: string, orderId: string, nextStatus: OrderStatus): Promise<void> {
  const notify = NOTIFY[nextStatus]
  if (!notify) return
  const orderSnap = await getAdminDb().collection("orders").doc(orderId).get()
  const displayId = (orderSnap.data() as Order | undefined)?.orderNumber ?? orderId.slice(0, 8)
  await writeSellerNotification({
    sellerId,
    type: notify.type,
    title: notify.title,
    message: notify.message(displayId),
    relatedType: "order",
    relatedId: orderId,
  })
}
