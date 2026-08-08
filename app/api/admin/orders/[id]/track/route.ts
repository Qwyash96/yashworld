import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { trackShipment, getShippingProviderDisplayName } from "@/lib/shipping-service"
import { applyTrackingUpdate } from "@/lib/order-tracking-sync"
import type { Order } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

interface TrackBody {
  sellerId?: string
}

/**
 * Admin equivalent of the seller's own "Sync Tracking" pull
 * (app/api/seller/orders/[id]/track) — same live fetch from whichever
 * provider auto-shipped this seller's portion, applied through the same
 * shared lib/order-tracking-sync.ts logic a webhook or the seller's own
 * sync uses, so an admin-triggered sync can never apply a status the
 * provider didn't actually report.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "order_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const body = (await request.json().catch(() => ({}))) as TrackBody
  if (!body.sellerId) return NextResponse.json({ error: "A sellerId is required." }, { status: 400 })

  const db = getAdminDb()
  const orderSnap = await db.collection("orders").doc(orderId).get()
  if (!orderSnap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = orderSnap.data() as Order

  const sellerOrder = order.sellerOrders.find((so) => so.sellerId === body.sellerId)
  if (!sellerOrder) return NextResponse.json({ error: "That seller has no items on this order." }, { status: 404 })
  if (!sellerOrder.shippingProvider || !sellerOrder.trackingNumber) {
    return NextResponse.json({ error: "This shipment isn't tracked via a connected shipping provider." }, { status: 400 })
  }

  try {
    const tracking = await trackShipment(sellerOrder.shippingProvider, sellerOrder.trackingNumber)
    const result = await applyTrackingUpdate(orderId, body.sellerId, tracking, "sync")
    return NextResponse.json({ ok: true, rawStatus: tracking.rawStatus, changed: result.changed, status: result.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to fetch tracking from ${getShippingProviderDisplayName(sellerOrder.shippingProvider)}.` },
      { status: 502 },
    )
  }
}
