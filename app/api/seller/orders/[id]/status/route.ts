import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { tryAutoGenerateAwb as tryAutoGenerateAwbCommon, cancelShipment as cancelShipmentCommon, type AutoAwbResult } from "@/lib/shipping-service"
import {
  buildTransitionedSellerOrder,
  notifySellerOrderTransition,
} from "@/lib/order-status-transition"
import type { Order, OrderStatus } from "@/types/order"
import type { Product } from "@/types/product"

type RouteContext = { params: Promise<{ id: string }> }

interface StatusBody {
  status?: OrderStatus
  /** Required when rejecting/cancelling — stored as SellerOrder.rejectionReason and as the timeline note. */
  reason?: string
  /** Required exactly when transitioning to "Pickup Requested" (the Schedule Pickup action), unless a shipping provider's Auto AWB Generation is on — then this route assigns it live instead. */
  courierPartner?: string
  pickupDate?: string
  pickupTime?: string
  trackingNumber?: string
}

/**
 * When a shipping provider's "Auto AWB Generation" setting is on, creates
 * the real shipment and assigns a real AWB through that provider's own API
 * (see lib/shipping-service.ts — the common interface every auto-AWB-
 * capable courier implements: Shiprocket, Amazon Shipping, Ekart, Shift
 * Logistics) instead of requiring the seller to type in a courier name and
 * tracking number by hand. Deliberately called BEFORE the Firestore
 * transaction below (a transaction should never wrap an external network
 * call — Firestore may retry it on contention) using a plain,
 * non-transactional read of the order; the transaction re-reads and
 * re-validates the transition itself, so a stale read here just fails
 * safely rather than corrupting state. Returns null when no provider has
 * Auto AWB configured, so the caller falls back to the existing manual flow
 * untouched.
 */
async function tryAutoGenerateAwb(order: Order, sellerId: string): Promise<AutoAwbResult | null> {
  const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
  if (!sellerOrder) throw new Error("You don't have any items on this order.")

  const db = getAdminDb()
  const productSnaps = await db.getAll(...sellerOrder.items.map((item) => db.collection("products").doc(item.productId)))
  const items = sellerOrder.items.map((item, i) => ({
    productId: item.productId,
    name: (productSnaps[i].data() as Product | undefined)?.name ?? item.productId,
    quantity: item.quantity,
    unitPrice: item.price,
  }))
  const subTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return tryAutoGenerateAwbCommon({
    // One order can hold several sellers' shipments — each courier needs a
    // unique order_id per shipment, so this seller's uid is appended.
    orderId: `${order.id}-${sellerId}`,
    pickupLocationName: "",
    paymentMethod: order.paymentMethod,
    subTotal,
    customerName: order.shippingAddress.fullName,
    phone: order.shippingAddress.phone,
    email: order.contactEmail,
    addressLine1: order.shippingAddress.line1,
    addressLine2: order.shippingAddress.line2,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    postalCode: order.shippingAddress.postalCode,
    items,
  })
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

  if (nextStatus === "Cancelled" && !body.reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject/cancel an order." }, { status: 400 })
  }

  let autoAwb: AutoAwbResult | null = null
  if (nextStatus === "Pickup Requested") {
    try {
      const orderSnap = await db.collection("orders").doc(orderId).get()
      if (!orderSnap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
      autoAwb = await tryAutoGenerateAwb(orderSnap.data() as Order, auth.uid)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to auto-generate the AWB with the configured shipping provider." },
        { status: 502 },
      )
    }
    if (!autoAwb && !body.courierPartner?.trim()) {
      return NextResponse.json({ error: "Courier partner is required to schedule a pickup." }, { status: 400 })
    }
  }

  // Cancel Pickup on an auto-shipped order (Pickup Requested -> Packed) —
  // actually cancels the real shipment with whichever provider created it,
  // not just the local status. Best-effort in the sense that a courier that
  // already picked up the package will legitimately reject the cancel; a
  // seller in that position needs to know, not have this silently ignored.
  if (nextStatus === "Packed") {
    const orderSnap = await db.collection("orders").doc(orderId).get()
    const currentSellerOrder = (orderSnap.data() as Order | undefined)?.sellerOrders.find((so) => so.sellerId === auth.uid)
    if (currentSellerOrder?.status === "Pickup Requested" && currentSellerOrder.shippingProvider && currentSellerOrder.providerShipmentId) {
      try {
        await cancelShipmentCommon(currentSellerOrder.shippingProvider, currentSellerOrder.providerShipmentId)
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to cancel the shipment with the shipping provider." },
          { status: 502 },
        )
      }
    }
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

      const updatedSellerOrder = {
        ...buildTransitionedSellerOrder(sellerOrder, nextStatus, {
          reason: body.reason,
          courierPartner: autoAwb?.courierPartner ?? body.courierPartner,
          pickupDate: body.pickupDate,
          pickupTime: body.pickupTime,
          trackingNumber: autoAwb?.trackingNumber ?? body.trackingNumber,
        }),
        ...(autoAwb && nextStatus === "Pickup Requested"
          ? { shippingProvider: autoAwb.shippingProvider, providerShipmentId: autoAwb.providerShipmentId }
          : {}),
      }

      const sellerOrders = [...order.sellerOrders]
      sellerOrders[index] = updatedSellerOrder

      tx.update(orderRef, {
        sellerOrders,
        ...(nextStatus === "Delivered" ? { hasHeldPayouts: true } : {}),
      })
    })

    await notifySellerOrderTransition(auth.uid, orderId, nextStatus)

    return NextResponse.json({ ok: true, ...(autoAwb ? { courierPartner: autoAwb.courierPartner, trackingNumber: autoAwb.trackingNumber } : {}) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order status." },
      { status: 400 },
    )
  }
}
