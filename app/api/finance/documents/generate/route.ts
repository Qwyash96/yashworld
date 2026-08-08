import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { createFinanceDocumentRecord, findExistingFinanceDocument } from "@/lib/finance-documents"
import type { Order } from "@/types/order"

interface GenerateBody {
  type?: "invoice" | "payment_receipt"
  orderId?: string
}

/**
 * Mints a FinanceDocument metadata record (a real sequential document
 * number + an audit trail entry — "Store document metadata securely") for
 * a buyer's own Invoice or Payment Receipt, generated on demand exactly
 * like every other document in this system (lib/documents/*.ts, jsPDF,
 * client-side) — this endpoint only records that it happened and returns
 * the number to print on it; it never builds the PDF itself. Scoped
 * strictly to the caller's own order — a buyer can never mint a document
 * for someone else's order by supplying a different orderId.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as GenerateBody
  if (body.type !== "invoice" && body.type !== "payment_receipt") {
    return NextResponse.json({ error: "type must be 'invoice' or 'payment_receipt'." }, { status: 400 })
  }
  if (!body.orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 })

  const snap = await getAdminDb().collection("orders").doc(body.orderId).get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = { id: snap.id, ...snap.data() } as Order
  if (order.buyerId !== auth.uid) {
    return NextResponse.json({ error: "You don't have access to this order." }, { status: 403 })
  }
  if (body.type === "payment_receipt" && order.paymentStatus !== "Paid" && order.paymentStatus !== "Refunded") {
    return NextResponse.json({ error: "No payment has been received for this order yet." }, { status: 400 })
  }

  // Idempotent: re-generating the same order's Invoice/Payment Receipt
  // (e.g. clicking "Download" again) must return the SAME document number
  // every time, never mint a fresh one for what is functionally the same
  // document.
  const existing = await findExistingFinanceDocument(order.id, body.type, order.buyerId)
  const document =
    existing ??
    (await createFinanceDocumentRecord(
      { type: body.type, orderId: order.id, partyType: "buyer", partyId: order.buyerId, amount: order.totals.total },
      { uid: auth.uid, email: order.contactEmail },
    ))

  return NextResponse.json({ ok: true, document })
}
