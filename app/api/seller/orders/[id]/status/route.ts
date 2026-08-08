import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { cancelShipment as cancelShipmentCommon } from "@/lib/shipping-service"
import { attemptAutoShipment, type AutoShipmentAttempt } from "@/lib/order-auto-fulfillment"
import { buildTransitionedSellerOrder, buildAutoShippedSellerOrder, notifySellerOrderTransition } from "@/lib/order-status-transition"
import { mintSequentialId } from "@/lib/sequential-id"
import type { Order, OrderStatus } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

interface StatusBody {
  status?: OrderStatus
  /** Required when rejecting/cancelling — stored as SellerOrder.rejectionReason/cancellationReason and as the timeline note. */
  reason?: string
}

// Sellers may only ever directly set one of these three. Everything else in
// the fulfilment pipeline — shipment creation, pickup, in-transit, out for
// delivery, delivered — is now driven automatically by the shipping
// provider (see lib/order-auto-fulfillment.ts, lib/order-tracking-sync.ts,
// and the provider webhook route) once the seller accepts. A seller can no
// longer mark "Ready To Pack"/"Packed"/"Pickup Requested" or, critically,
// "Delivered" — only the shipping provider can confirm delivery.
const SELLER_POSTABLE_STATUSES: OrderStatus[] = ["Accepted", "Cancelled", "Returned"]

/**
 * The one trusted path for a seller to act on their portion of an order —
 * now covering only Accept/Reject, Cancel, and Mark Returned. Firestore
 * rules don't let a seller write orders/{id} directly (that let them
 * rewrite the WHOLE sellerOrders array, including commissionAmount/
 * payoutAmount). This route only ever changes status/timeline/rejection
 * fields — commissionAmount/payoutAmount are read from the stored
 * sellerOrder and written back unchanged, never accepted from the request body.
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

  if (!SELLER_POSTABLE_STATUSES.includes(nextStatus)) {
    return NextResponse.json(
      { error: `"${nextStatus}" is set automatically by the shipping provider, not by the seller.` },
      { status: 400 },
    )
  }

  if (nextStatus === "Cancelled" && !body.reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject/cancel an order." }, { status: 400 })
  }

  // Cancelling an order that already has a real shipment attached also
  // cancels that shipment with the provider — best-effort, mirroring the
  // buyer's own self-cancel route (app/api/orders/[id]/cancel). Never blocks
  // the seller's own cancellation if the provider call fails.
  if (nextStatus === "Cancelled") {
    const orderSnap = await db.collection("orders").doc(orderId).get()
    const currentSellerOrder = (orderSnap.data() as Order | undefined)?.sellerOrders.find((so) => so.sellerId === auth.uid)
    if (currentSellerOrder?.shippingProvider && currentSellerOrder.providerShipmentId) {
      try {
        await cancelShipmentCommon(currentSellerOrder.shippingProvider, currentSellerOrder.providerShipmentId)
      } catch (error) {
        console.error("[seller-order-cancel] failed to cancel shipment with provider:", error)
      }
    }
  }

  // A seller re-posting "Accepted" while the order is already "Accepted" is
  // not a real transition — it's a retry of the automatic shipment-creation
  // step after a previous attempt left a real shippingSetupError (see the
  // "Shipping setup pending" retry button). Detected up front so the
  // transaction below can skip buildTransitionedSellerOrder's one-hop check
  // for this specific case instead of rejecting it as an illegal transition.
  let isRetry = false
  if (nextStatus === "Accepted") {
    const orderSnap = await db.collection("orders").doc(orderId).get()
    const currentSellerOrder = (orderSnap.data() as Order | undefined)?.sellerOrders.find((so) => so.sellerId === auth.uid)
    isRetry = currentSellerOrder?.status === "Accepted"
  }

  // Minted before the transaction (nextStatus is already known) since
  // buildTransitionedSellerOrder is deliberately kept pure/synchronous —
  // see lib/sequential-id.ts's own doc comment on the accepted tradeoff
  // (an infrequent transaction failure here would skip a RET number, never
  // reuse one).
  const returnNumber = nextStatus === "Returned" ? await mintSequentialId("return") : undefined

  try {
    if (!isRetry) {
      await db.runTransaction(async (tx) => {
        const orderRef = db.collection("orders").doc(orderId)
        const snap = await tx.get(orderRef)
        if (!snap.exists) throw new Error("Order not found.")
        const order = snap.data() as Order

        const index = order.sellerOrders.findIndex((so) => so.sellerId === auth.uid)
        if (index === -1) throw new Error("You don't have any items on this order.")
        const sellerOrder = order.sellerOrders[index]

        const updatedSellerOrder = buildTransitionedSellerOrder(sellerOrder, nextStatus, { reason: body.reason, returnNumber })

        const sellerOrders = [...order.sellerOrders]
        sellerOrders[index] = updatedSellerOrder

        tx.update(orderRef, { sellerOrders })
      })

      await notifySellerOrderTransition(auth.uid, orderId, nextStatus)
    }

    // The seller's only fulfilment action: right after a successful Accept
    // (or a retry of a previously failed attempt), immediately attempt real
    // shipment creation through whichever shipping provider is connected.
    // Awaited (not fire-and-forget) — this app has no background job runner,
    // and Vercel serverless functions don't reliably keep running past their
    // response, so a true "kick off and return" wouldn't dependably
    // complete. Failure never blocks the Accept itself, which has already
    // committed above; it only leaves a real shippingSetupError note instead
    // of a fake AWB.
    let shipment: { ok: true; courierPartner: string } | { ok: false; error: string } | null = null
    if (nextStatus === "Accepted") {
      const attempt = await runAutoShipmentAttempt(orderId, auth.uid)
      shipment = attempt.ok ? { ok: true, courierPartner: attempt.awb.courierPartner } : { ok: false, error: attempt.error }
    }

    return NextResponse.json({ ok: true, ...(shipment ? { shipment } : {}) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order status." },
      { status: 400 },
    )
  }
}

async function runAutoShipmentAttempt(orderId: string, sellerId: string): Promise<AutoShipmentAttempt> {
  const db = getAdminDb()
  const orderSnap = await db.collection("orders").doc(orderId).get()
  if (!orderSnap.exists) return { ok: false, error: "Order not found." }
  const order = orderSnap.data() as Order

  const attempt = await attemptAutoShipment(order, sellerId)

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) return
      const fresh = snap.data() as Order
      const index = fresh.sellerOrders.findIndex((so) => so.sellerId === sellerId)
      if (index === -1) return
      const sellerOrder = fresh.sellerOrders[index]
      // Only apply if still sitting where this flow left it — defensive
      // against a retried/double-fired request racing itself.
      if (sellerOrder.status !== "Accepted") return

      const sellerOrders = [...fresh.sellerOrders]
      sellerOrders[index] = attempt.ok ? buildAutoShippedSellerOrder(sellerOrder, attempt.awb) : { ...sellerOrder, shippingSetupError: attempt.error }
      tx.update(orderRef, { sellerOrders })
    })

    if (attempt.ok) {
      await notifySellerOrderTransition(sellerId, orderId, "Pickup Requested")
    }
  } catch (error) {
    console.error("[auto-shipment] failed to record result:", error)
  }

  return attempt
}
