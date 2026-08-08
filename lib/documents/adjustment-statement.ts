import { jsPDF } from "jspdf"
import { formatPrice } from "@/lib/products"
import type { AdjustmentDocumentContext } from "@/lib/documents/finance-document-context"

/** Debit/Credit/Adjustment Statement — a Finance-approved Charge, Credit,
 * or Refund Adjustment. Built entirely from real, already-approved
 * adjustment data (see lib/finance-adjustment-service.ts) — no invented
 * fields, no GST line (none is configured — see
 * app/api/finance/business-info/route.ts). Downloads directly, same
 * generate-on-demand pattern as the existing invoice/packing-slip
 * generators (lib/documents/invoice.ts) — returns the built jsPDF instance
 * rather than saving it directly, so the caller can view/download/print it
 * via lib/documents/pdf-actions.ts without rebuilding. */
export function buildAdjustmentStatementPdf(ctx: AdjustmentDocumentContext): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(ctx.documentTypeLabel.toUpperCase(), marginX, y)
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
  doc.text(`Party: ${ctx.partyLabel}`, marginX, y)
  if (ctx.orderId) {
    doc.text(`Order ID: #${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}`, 555 - marginX, y, { align: "right" })
  }

  y += 35
  doc.setFont("helvetica", "bold")
  doc.text("Description", marginX, y)
  doc.text("Amount", 555 - marginX, y, { align: "right" })
  y += 8
  doc.line(marginX, y, 555, y)
  y += 20

  doc.setFont("helvetica", "normal")
  doc.text(ctx.type === "credit" ? "Credit" : ctx.type === "refund_adjustment" ? "Refund Adjustment" : "Charge", marginX, y)
  doc.text(`${ctx.type === "credit" ? "+" : "-"}${formatPrice(ctx.amount)}`, 555 - marginX, y, { align: "right" })

  y += 30
  doc.line(marginX, y, 555, y)
  y += 20
  doc.text("Previous Balance", marginX, y)
  doc.text(formatPrice(ctx.previousBalance), 555 - marginX, y, { align: "right" })
  y += 18
  doc.setFont("helvetica", "bold")
  doc.text("New Balance", marginX, y)
  doc.text(formatPrice(ctx.newBalance), 555 - marginX, y, { align: "right" })

  y += 35
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Reason", marginX, y)
  doc.setFont("helvetica", "normal")
  y += 15
  doc.text(ctx.reason, marginX, y, { maxWidth: 515 })

  if (ctx.notes) {
    y += 30
    doc.setFont("helvetica", "bold")
    doc.text("Notes", marginX, y)
    doc.setFont("helvetica", "normal")
    y += 15
    doc.text(ctx.notes, marginX, y, { maxWidth: 515 })
  }

  y += 35
  doc.setFontSize(9)
  doc.text(`Created By: ${ctx.createdByEmail}`, marginX, y)
  y += 14
  doc.text(`Approved By: ${ctx.approvedByEmail ?? "—"}${ctx.approvedAt ? ` on ${new Date(ctx.approvedAt).toLocaleString()}` : ""}`, marginX, y)
  y += 14
  doc.text(`Status: ${ctx.status}`, marginX, y)

  y += 25
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`${ctx.business.siteName} · ${ctx.business.supportEmail} · ${ctx.business.supportPhone}`, marginX, y)

  return doc
}
