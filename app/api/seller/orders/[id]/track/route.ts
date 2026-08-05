import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { trackShipment, getShippingProviderDisplayName, type CommonTrackingResult } from "@/lib/shipping-service"
import { buildTransitionedSellerOrder, notifySellerOrderTransition } from "@/lib/order-status-transition"
import { ORDER_FULFILMENT_SEQUENCE } from "@/types/order-lifecycle"
import type { Order, SellerOrder } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Live pull, not a passive webhook (see lib/integrations/adapters/shiprocket.ts's
 * doc comment for why) — the seller clicks "Sync Tracking" and this fetches
 * the AWB's current status straight from whichever provider auto-shipped
 * this order (see lib/shipping-service.ts — the common interface every
 * auto-AWB-capable courier implements), then walks the sellerOrder forward
 * through the SAME validated fulfilment sequence a manual update uses (one
 * hop per intermediate stage, so a courier update that skipped straight
 * from "Picked Up" to "Delivered" between syncs still produces a complete,
 * honest timeline instead of a single jump).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApprovedSeller(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const db = getAdminDb()

  const orderSnap = await db.collection("orders").doc(orderId).get()
  if (!orderSnap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = orderSnap.data() as Order

  const sellerOrder = order.sellerOrders.find((so) => so.sellerId === auth.uid)
  if (!sellerOrder) return NextResponse.json({ error: "You don't have any items on this order." }, { status: 403 })
  if (!sellerOrder.shippingProvider || !sellerOrder.trackingNumber) {
    return NextResponse.json({ error: "This shipment isn't tracked via a connected shipping provider." }, { status: 400 })
  }

  let rawStatus: string
  let mappedStatus: CommonTrackingResult["mappedStatus"]
  try {
    const tracking = await trackShipment(sellerOrder.shippingProvider, sellerOrder.trackingNumber)
    rawStatus = tracking.rawStatus
    mappedStatus = tracking.mappedStatus
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to fetch tracking from ${getShippingProviderDisplayName(sellerOrder.shippingProvider)}.` },
      { status: 502 },
    )
  }

  const currentIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(sellerOrder.status)
  const targetIndex = mappedStatus ? ORDER_FULFILMENT_SEQUENCE.indexOf(mappedStatus) : -1

  if (!mappedStatus || targetIndex <= currentIndex) {
    return NextResponse.json({ ok: true, rawStatus, changed: false })
  }

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error("Order not found.")
      const freshOrder = snap.data() as Order
      const index = freshOrder.sellerOrders.findIndex((so) => so.sellerId === auth.uid)
      if (index === -1) throw new Error("You don't have any items on this order.")

      let updated: SellerOrder = freshOrder.sellerOrders[index]
      // Freshly-read status may have moved since the GET above — reclamp to it.
      const freshIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(updated.status)
      for (let i = freshIndex + 1; i <= targetIndex; i++) {
        const isFinalHop = i === targetIndex
        updated = buildTransitionedSellerOrder(updated, ORDER_FULFILMENT_SEQUENCE[i], {
          ...(isFinalHop ? { reason: `Synced from ${getShippingProviderDisplayName(sellerOrder.shippingProvider!)}: ${rawStatus}` } : {}),
        })
      }

      const sellerOrders = [...freshOrder.sellerOrders]
      sellerOrders[index] = updated

      tx.update(orderRef, {
        sellerOrders,
        ...(mappedStatus === "Delivered" ? { hasHeldPayouts: true } : {}),
      })
    })

    await notifySellerOrderTransition(auth.uid, orderId, mappedStatus)

    return NextResponse.json({ ok: true, rawStatus, changed: true, status: mappedStatus })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync tracking status." },
      { status: 400 },
    )
  }
}
