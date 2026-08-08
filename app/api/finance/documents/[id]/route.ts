import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { requireAnyPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getFinanceDocument } from "@/lib/finance-documents"
import { getAdjustment } from "@/lib/finance-adjustment-service"
import { getGeneralSettings } from "@/lib/platform-settings"
import type { Order } from "@/types/order"
import type { RefundRequest } from "@/types/refund"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * One financial document's metadata PLUS a fully-assembled PDF context
 * (see lib/documents/finance-document-context.ts) — the client hands this
 * straight to buildAdjustmentStatementPdf/buildRefundReceiptPdf without
 * making further authenticated calls of its own, so exactly what a caller
 * is allowed to see is decided once, here, server-side. A buyer or seller
 * may only ever fetch their OWN document (partyId === their uid); an admin
 * with "payments" or "order_management" may fetch any.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const document = await getFinanceDocument(id)
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 })

  const adminAuth = await requireAnyPermission(request, ["payments", "order_management"])
  let callerUid: string
  if (adminAuth.ok) {
    callerUid = adminAuth.uid
  } else {
    const userAuth = await requireSignedInUser(request)
    if (!userAuth.ok) return NextResponse.json({ error: userAuth.error }, { status: userAuth.status })
    if (userAuth.uid !== document.partyId) {
      return NextResponse.json({ error: "You don't have access to this document." }, { status: 403 })
    }
    callerUid = userAuth.uid
  }
  void callerUid

  const business = await getGeneralSettings()
  const businessInfo = { siteName: business.siteName, supportEmail: business.supportEmail, supportPhone: business.supportPhone }

  if (document.type === "debit_statement" || document.type === "credit_statement") {
    const adjustment = document.relatedAdjustmentId ? await getAdjustment(document.relatedAdjustmentId) : null
    if (!adjustment) return NextResponse.json({ error: "The underlying adjustment for this document was not found." }, { status: 404 })
    return NextResponse.json({
      document,
      context: {
        business: businessInfo,
        documentNumber: document.documentNumber,
        documentTypeLabel: document.type === "credit_statement" ? "Credit / Adjustment Statement" : "Debit / Adjustment Statement",
        createdAt: document.createdAt,
        orderId: adjustment.orderId,
        partyLabel: adjustment.partyType === "seller" ? `Seller ${adjustment.partyId}` : "Buyer",
        type: adjustment.type,
        amount: adjustment.amount,
        reason: adjustment.reason,
        notes: adjustment.notes,
        previousBalance: adjustment.previousBalance,
        newBalance: adjustment.newBalance,
        createdByEmail: adjustment.createdBy.email,
        approvedByEmail: adjustment.approvedBy?.email,
        approvedAt: adjustment.approvedAt,
        status: adjustment.status,
      },
    })
  }

  if (document.type === "refund_receipt" || document.type === "credit_note") {
    if (!document.orderId || !document.relatedRefundId) {
      return NextResponse.json({ error: "This document is missing its underlying refund reference." }, { status: 404 })
    }
    const [orderSnap, refundSnap] = await Promise.all([
      getAdminDb().collection("orders").doc(document.orderId).get(),
      getAdminDb().collection("orders").doc(document.orderId).collection("refunds").doc(document.relatedRefundId).get(),
    ])
    if (!orderSnap.exists || !refundSnap.exists) return NextResponse.json({ error: "The underlying refund was not found." }, { status: 404 })
    const order = orderSnap.data() as Order
    const refund = refundSnap.data() as RefundRequest
    return NextResponse.json({
      document,
      context: {
        business: businessInfo,
        documentNumber: document.documentNumber,
        createdAt: document.createdAt,
        orderId: order.id,
        customerName: order.shippingAddress.fullName,
        mode: refund.mode,
        amount: refund.amount,
        reason: refund.reason,
        eligibleAmount: refund.breakdown.eligibleAmount,
        adjustmentAmount: refund.breakdown.adjustmentAmount,
        paymentMethod: order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
        status: refund.status,
        gatewayRefundId: refund.gatewayRefundId,
        approvedByEmail: refund.approvedBy.email,
      },
    })
  }

  if (document.type === "payment_receipt") {
    if (!document.orderId) return NextResponse.json({ error: "This document is missing its order reference." }, { status: 404 })
    const orderSnap = await getAdminDb().collection("orders").doc(document.orderId).get()
    if (!orderSnap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
    const order = orderSnap.data() as Order
    return NextResponse.json({
      document,
      context: {
        business: businessInfo,
        documentNumber: document.documentNumber,
        orderId: order.id,
        createdAt: document.createdAt,
        customerName: order.shippingAddress.fullName,
        amount: document.amount,
        paymentMethod: order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
        paymentStatus: order.paymentStatus,
      },
    })
  }

  return NextResponse.json({ error: "Unsupported document type for detail view." }, { status: 400 })
}
