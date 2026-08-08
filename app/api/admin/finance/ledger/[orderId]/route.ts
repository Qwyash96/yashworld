import { NextResponse, type NextRequest } from "next/server"
import { requireAnyPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getRefundHistory } from "@/lib/refund-service"
import { listAdjustments } from "@/lib/finance-adjustment-service"
import { listFinanceDocuments } from "@/lib/finance-documents"
import { round2 } from "@/lib/utils"
import type { Order } from "@/types/order"

type RouteContext = { params: Promise<{ orderId: string }> }

export interface LedgerEntry {
  label: string
  amount: number
  at: string
  documentId?: string
  documentNumber?: string
}

/**
 * One order's full transaction/ledger view — every Sale, Platform
 * Commission, Charge, Credit, Refund Adjustment, and completed Refund,
 * each linked to its generated document where one exists. Read-only;
 * "payments" or "order_management" (Operations reviewing a return case).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAnyPermission(request, ["payments", "order_management"])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { orderId } = await params
  const snap = await getAdminDb().collection("orders").doc(orderId).get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = { id: snap.id, ...snap.data() } as Order

  const [adjustments, refunds, documents] = await Promise.all([
    listAdjustments({ orderId }),
    getRefundHistory(orderId),
    listFinanceDocuments({ orderId }),
  ])

  const documentByAdjustmentId = new Map(documents.filter((d) => d.relatedAdjustmentId).map((d) => [d.relatedAdjustmentId!, d]))
  const documentByRefundId = new Map(documents.filter((d) => d.relatedRefundId).map((d) => [d.relatedRefundId!, d]))

  const entries: LedgerEntry[] = []

  for (const so of order.sellerOrders) {
    const itemTotal = round2(so.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
    entries.push({ label: `Sale — Seller ${so.sellerId}`, amount: itemTotal, at: order.createdAt })
    if (so.commissionAmount > 0) {
      entries.push({ label: `Platform Commission — Seller ${so.sellerId}`, amount: -so.commissionAmount, at: order.createdAt })
    }
  }
  if (order.totals.shipping > 0) entries.push({ label: "Delivery Charge", amount: order.totals.shipping, at: order.createdAt })
  if (order.totals.discount > 0) entries.push({ label: "Discount", amount: -order.totals.discount, at: order.createdAt })

  for (const adjustment of adjustments) {
    if (adjustment.status !== "Approved") continue
    const label =
      adjustment.type === "credit"
        ? `Finance Credit${adjustment.partyType === "seller" ? ` — Seller ${adjustment.partyId}` : ""}`
        : adjustment.type === "refund_adjustment"
          ? "Refund Adjustment"
          : `Charge${adjustment.partyType === "seller" ? ` — Seller ${adjustment.partyId}` : ""}`
    const signed = adjustment.type === "credit" ? adjustment.amount : -adjustment.amount
    const document = documentByAdjustmentId.get(adjustment.id)
    entries.push({ label, amount: signed, at: adjustment.approvedAt ?? adjustment.createdAt, documentId: document?.id, documentNumber: document?.documentNumber })
  }

  for (const refund of refunds) {
    if (refund.status !== "Refunded") continue
    const document = documentByRefundId.get(refund.id)
    entries.push({
      label: refund.sellerId ? `Buyer Refund — Seller ${refund.sellerId}` : "Buyer Refund",
      amount: -refund.amount,
      at: refund.processedAt ?? refund.createdAt,
      documentId: document?.id,
      documentNumber: document?.documentNumber,
    })
  }

  entries.sort((a, b) => a.at.localeCompare(b.at))

  return NextResponse.json({ orderId, entries, netTotal: round2(entries.reduce((sum, e) => sum + e.amount, 0)) })
}
