import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"

type RouteContext = { params: Promise<{ id: string }> }

interface NoteBody {
  note?: string
}

/** A seller's own private note on their portion of an order — packing
 * instructions, a reminder, anything. Never shown to the buyer. Separate
 * from the status route since a note save isn't a fulfilment transition
 * and shouldn't require a status in the body. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApprovedSeller(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const body = (await request.json().catch(() => ({}))) as NoteBody
  const note = body.note?.trim() ?? ""

  const db = getAdminDb()

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error("Order not found.")
      const order = snap.data() as Order

      const index = order.sellerOrders.findIndex((so) => so.sellerId === auth.uid)
      if (index === -1) throw new Error("You don't have any items on this order.")

      const sellerOrders = [...order.sellerOrders]
      sellerOrders[index] = note ? { ...sellerOrders[index], note } : omitNote(sellerOrders[index])

      tx.update(orderRef, { sellerOrders })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save note." },
      { status: 400 },
    )
  }
}

function omitNote<T extends { note?: string }>(sellerOrder: T): T {
  const { note, ...rest } = sellerOrder
  void note
  return rest as T
}
