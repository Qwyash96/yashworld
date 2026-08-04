import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable } from "@/types/order-lifecycle"
import type { Order, OrderStatus } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

interface StatusBody {
  status?: OrderStatus
}

function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "Cancelled") return isCancellable(from)
  const fromIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(from)
  const toIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(to)
  return fromIndex !== -1 && toIndex === fromIndex + 1
}

/**
 * The one trusted path for a seller to progress their portion of an order.
 * Firestore rules no longer let a seller write orders/{id} directly (that
 * let them rewrite the WHOLE sellerOrders array, including
 * commissionAmount/payoutAmount — harmless before a real wallet existed,
 * not harmless once one reads that field as real money). This route only
 * ever changes `status` (and, on delivery, `deliveredAt`/`payoutStatus`) —
 * commissionAmount/payoutAmount are read from the stored sellerOrder and
 * written back unchanged, never accepted from the request body.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const db = getAdminDb()

  const applicationSnap = await db.collection("sellerApplications").doc(auth.uid).get()
  if (applicationSnap.data()?.status !== "approved") {
    return NextResponse.json({ error: "Only approved sellers can update orders." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as StatusBody
  if (!body.status) {
    return NextResponse.json({ error: "A status is required." }, { status: 400 })
  }
  const nextStatus = body.status

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
      const updatedSellerOrder = {
        ...sellerOrder,
        status: nextStatus,
        ...(nextStatus === "Delivered" ? { deliveredAt: now, payoutStatus: "Hold" as const } : {}),
      }

      const sellerOrders = [...order.sellerOrders]
      sellerOrders[index] = updatedSellerOrder

      tx.update(orderRef, {
        sellerOrders,
        ...(nextStatus === "Delivered" ? { hasHeldPayouts: true } : {}),
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order status." },
      { status: 400 },
    )
  }
}
