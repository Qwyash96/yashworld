import { jsPDF } from "jspdf"
import { formatPrice } from "@/lib/products"
import type { PaymentReceiptContext } from "@/lib/documents/finance-document-context"

/** Payment Receipt — a buyer-facing proof of payment, distinct from the
 * Tax Invoice (lib/documents/invoice.ts, itemized) — this is the simpler
 * "we received your payment" document. Generated on demand from the
 * buyer's own order data, same pattern as every other document generator
 * in lib/documents/. Returns the built jsPDF instance — see
 * lib/documents/pdf-actions.ts. */
export function buildPaymentReceiptPdf(ctx: PaymentReceiptContext): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("PAYMENT RECEIPT", marginX, y)
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
  doc.text(`Received From: ${ctx.customerName}`, 555 - marginX, y, { align: "right" })

  y += 40
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("Amount Received", marginX, y)
  doc.text(formatPrice(ctx.amount), 555 - marginX, y, { align: "right" })

  y += 40
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Payment Method: ${ctx.paymentMethod}`, marginX, y)
  y += 14
  doc.text(`Payment Status: ${ctx.paymentStatus}`, marginX, y)

  y += 25
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`${ctx.business.siteName} · ${ctx.business.supportEmail} · ${ctx.business.supportPhone}`, marginX, y)

  return doc
}
