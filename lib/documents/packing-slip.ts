import { jsPDF } from "jspdf"
import type { OrderDocumentContext } from "@/lib/documents/order-document-context"

/** Items and quantities only — deliberately no pricing (standard packing-
 * slip convention, since it travels with the physical package) and no
 * phone/email. */
export function generatePackingSlipPdf(ctx: OrderDocumentContext): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("PACKING SLIP", marginX, y)

  y += 25
  doc.setDrawColor(200)
  doc.line(marginX, y, 555, y)

  y += 25
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Order ID: #${ctx.orderId.slice(0, 8)}`, marginX, y)
  doc.text(`Order Date: ${new Date(ctx.createdAt).toLocaleDateString()}`, 555 - marginX, y, { align: "right" })

  y += 30
  doc.setFont("helvetica", "bold")
  doc.text("Deliver To", marginX, y)
  doc.setFont("helvetica", "normal")
  y += 15
  doc.text(ctx.customerName, marginX, y)
  y += 15
  doc.text(ctx.address.line1, marginX, y)
  if (ctx.address.line2) {
    y += 15
    doc.text(ctx.address.line2, marginX, y)
  }
  if (ctx.address.landmark) {
    y += 15
    doc.text(`Landmark: ${ctx.address.landmark}`, marginX, y)
  }
  y += 15
  doc.text(`${ctx.address.city}, ${ctx.address.state} - ${ctx.address.postalCode}`, marginX, y)

  y += 35
  doc.setFont("helvetica", "bold")
  doc.text("Item", marginX, y)
  doc.text("SKU", 380, y)
  doc.text("Qty", 500, y)
  y += 8
  doc.line(marginX, y, 555, y)
  y += 15

  doc.setFont("helvetica", "normal")
  for (const item of ctx.items) {
    doc.text(item.name.slice(0, 45), marginX, y)
    doc.text(item.sku.slice(0, 16), 380, y)
    doc.text(String(item.quantity), 500, y)
    y += 18
  }

  y += 20
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text("This slip is for packing verification only — no pricing information included.", marginX, y)

  doc.save(`packing-slip-${ctx.orderId.slice(0, 8)}.pdf`)
}
