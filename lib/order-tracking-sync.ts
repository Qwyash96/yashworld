import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { buildTransitionedSellerOrder, notifySellerOrderTransition } from "@/lib/order-status-transition"
import { ORDER_FULFILMENT_SEQUENCE } from "@/types/order-lifecycle"
import type { Order, SellerOrder } from "@/types/order"
import type { CommonTrackingResult } from "@/lib/shipping-service"

export interface ApplyTrackingUpdateResult {
  changed: boolean
  status?: SellerOrder["status"]
}

/**
 * Advances a seller-order forward through the same validated fulfilment
 * sequence a manual update uses — one hop per intermediate stage, so a
 * courier update that skipped straight from "Picked Up" to "Delivered"
 * between syncs still produces a complete timeline instead of a single
 * jump — from a real courier-reported status. Shared by the seller's
 * "Sync Tracking" pull (app/api/seller/orders/[id]/track), the admin
 * equivalent (app/api/admin/orders/[id]/track), and every provider's real
 * webhook handler (lib/integrations/adapters/*), so a courier update is
 * applied identically no matter which path delivered it. Never invents a
 * status the provider didn't actually report — a `mappedStatus` of null,
 * or one that isn't forward progress, just records that a sync happened
 * (lastTrackingSyncAt/lastWebhookAt) without changing `status`.
 */
export async function applyTrackingUpdate(
  orderId: string,
  sellerId: string,
  tracking: CommonTrackingResult,
  source: "sync" | "webhook",
): Promise<ApplyTrackingUpdateResult> {
  const db = getAdminDb()
  const now = new Date().toISOString()

  const orderSnap = await db.collection("orders").doc(orderId).get()
  if (!orderSnap.exists) return { changed: false }
  const order = orderSnap.data() as Order
  const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
  if (!sellerOrder) return { changed: false }

  const currentIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(sellerOrder.status)
  const targetIndex = tracking.mappedStatus ? ORDER_FULFILMENT_SEQUENCE.indexOf(tracking.mappedStatus) : -1

  const syncFields = { lastTrackingSyncAt: now, ...(source === "webhook" ? { lastWebhookAt: now, lastWebhookStatus: "ok" as const } : {}) }

  if (!tracking.mappedStatus || targetIndex <= currentIndex) {
    // No forward progress (an old/duplicate/earlier-stage update) — still
    // record that a sync/webhook happened, for the admin "Last Tracking
    // Sync"/"Webhook Status" display.
    try {
      await db.runTransaction(async (tx) => {
        const orderRef = db.collection("orders").doc(orderId)
        const snap = await tx.get(orderRef)
        if (!snap.exists) return
        const fresh = snap.data() as Order
        const index = fresh.sellerOrders.findIndex((so) => so.sellerId === sellerId)
        if (index === -1) return
        const sellerOrders = [...fresh.sellerOrders]
        sellerOrders[index] = { ...fresh.sellerOrders[index], ...syncFields }
        tx.update(orderRef, { sellerOrders })
      })
    } catch (error) {
      console.error("[order-tracking-sync] failed to record sync timestamp:", error)
    }
    return { changed: false }
  }

  let finalStatus: SellerOrder["status"] | undefined
  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error("Order not found.")
      const freshOrder = snap.data() as Order
      const index = freshOrder.sellerOrders.findIndex((so) => so.sellerId === sellerId)
      if (index === -1) throw new Error("Seller order not found.")

      let updated: SellerOrder = freshOrder.sellerOrders[index]
      const freshIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(updated.status)
      for (let i = freshIndex + 1; i <= targetIndex; i++) {
        const isFinalHop = i === targetIndex
        updated = buildTransitionedSellerOrder(updated, ORDER_FULFILMENT_SEQUENCE[i], {
          ...(isFinalHop ? { reason: `${source === "webhook" ? "Webhook" : "Synced"} from courier: ${tracking.rawStatus}` } : {}),
        })
      }
      updated = { ...updated, ...syncFields }
      finalStatus = updated.status

      const sellerOrders = [...freshOrder.sellerOrders]
      sellerOrders[index] = updated

      tx.update(orderRef, {
        sellerOrders,
        ...(tracking.mappedStatus === "Delivered" ? { hasHeldPayouts: true } : {}),
      })
    })

    if (finalStatus) {
      await notifySellerOrderTransition(sellerId, orderId, tracking.mappedStatus)
    }
    return { changed: true, status: finalStatus }
  } catch (error) {
    console.error("[order-tracking-sync] failed to apply update:", error)
    return { changed: false }
  }
}

/**
 * lib/order-auto-fulfillment.ts sends each shipping provider `${order.id}-${sellerId}`
 * as its own "order_id" reference at shipment-creation time — a real
 * provider webhook typically echoes that same reference back (Shiprocket:
 * `channel_order_id`; verify the exact field name against a real payload
 * once webhooks are actually configured, see this project's own README/
 * report on the order+shipping rewrite). Both halves are Firestore-safe
 * alphanumeric ids (no dashes), so splitting on the LAST "-" reliably
 * recovers both, regardless of dashes never appearing in either id.
 */
export function decomposeShipmentReference(reference: string): { orderId: string; sellerId: string } | null {
  const splitAt = reference.lastIndexOf("-")
  if (splitAt <= 0 || splitAt === reference.length - 1) return null
  return { orderId: reference.slice(0, splitAt), sellerId: reference.slice(splitAt + 1) }
}
