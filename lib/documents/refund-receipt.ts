import { jsPDF } from "jspdf"
import { formatPrice } from "@/lib/products"
import type { RefundDocumentContext } from "@/lib/documents/finance-document-context"

/** Refund Receipt — generated only once a refund has actually reached
 * "Refunded" (real gateway confirmation, or a Finance Admin's manual COD
 * completion) — see lib/refund-service.ts. Never generated on Approve
 * alone. Returns the built jsPDF instance — see lib/documents/pdf-actions.ts. */
export function buildRefundReceiptPdf(ctx: RefundDocumentContext): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("REFUND RECEIPT", marginX, y)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(ctx.business.siteName, 555 - marginX, y, { align: "right" })

  y += 25
  doc.setDrawColor(200)
  doc.line(marginX, y, 555, y)

  y += 25
  doc.setFontSize(10)
  doc.text(`Document No: ${ctx.documentNumber}`, marginX, y)
  doc.text(`Date: ${new Date(ctx.createdAt).toLocaleString()}`, 555 - marginX, y, { align: "right" })

  y += 20
  doc.text(`Order ID: #${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}`, marginX, y)
  doc.text(`Refunded To: ${ctx.customerName}`, 555 - marginX, y, { align: "right" })

  y += 35
  doc.setFont("helvetica", "bold")
  doc.text("Description", marginX, y)
  doc.text("Amount", 555 - marginX, y, { align: "right" })
  y += 8
  doc.line(marginX, y, 555, y)
  y += 20

  doc.setFont("helvetica", "normal")
  doc.text("Eligible Refund", marginX, y)
  doc.text(formatPrice(ctx.eligibleAmount), 555 - marginX, y, { align: "right" })
  if (ctx.adjustmentAmount > 0) {
    y += 18
    doc.text("Finance Adjustment", marginX, y)
    doc.text(`-${formatPrice(ctx.adjustmentAmount)}`, 555 - marginX, y, { align: "right" })
  }
  y += 20
  doc.line(350, y, 555, y)
  y += 18
  doc.setFont("helvetica", "bold")
  doc.text(ctx.mode === "full" ? "Full Refund" : "Manual Refund", marginX, y)
  doc.text(formatPrice(ctx.amount), 555 - marginX, y, { align: "right" })

  if (ctx.reason) {
    y += 35
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Reason", marginX, y)
    doc.setFont("helvetica", "normal")
    y += 15
    doc.text(ctx.reason, marginX, y, { maxWidth: 515 })
  }

  y += 35
  doc.setFontSize(9)
  doc.text(`Payment Method: ${ctx.paymentMethod}`, marginX, y)
  y += 14
  doc.text(`Refund Status: ${ctx.status}`, marginX, y)
  if (ctx.gatewayRefundId) {
    y += 14
    doc.text(`Gateway Reference: ${ctx.gatewayRefundId}`, marginX, y)
  }
  y += 14
  doc.text(`Approved By: ${ctx.approvedByEmail}`, marginX, y)

  y += 25
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`${ctx.business.siteName} · ${ctx.business.supportEmail} · ${ctx.business.supportPhone}`, marginX, y)

  return doc
}
