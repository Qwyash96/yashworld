import { jsPDF } from "jspdf"
import { generateBarcodeDataUrl } from "@/lib/documents/barcode"
import type { OrderDocumentContext } from "@/lib/documents/order-document-context"

/** A large-print shipping label — deliberately excludes phone/email, same
 * as everything else on the seller's order view. Embeds a real Code128
 * barcode of the AWB (or the order id if no AWB is assigned yet). */
export function generateShippingLabelPdf(ctx: OrderDocumentContext): void {
  const doc = new jsPDF({ unit: "pt", format: [400, 600] })
  const marginX = 30
  let y = 40

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("SHIPPING LABEL", marginX, y)

  y += 30
  doc.setDrawColor(0)
  doc.setLineWidth(1.5)
  doc.line(marginX, y, 370, y)

  y += 30
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text("SHIP TO:", marginX, y)
  y += 20
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(ctx.customerName, marginX, y)
  y += 20
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(ctx.address.line1, marginX, y, { maxWidth: 340 })
  if (ctx.address.line2) {
    y += 18
    doc.text(ctx.address.line2, marginX, y, { maxWidth: 340 })
  }
  if (ctx.address.landmark) {
    y += 18
    doc.text(`Landmark: ${ctx.address.landmark}`, marginX, y, { maxWidth: 340 })
  }
  y += 18
  doc.text(`${ctx.address.city}, ${ctx.address.state}`, marginX, y)
  y += 18
  doc.setFont("helvetica", "bold")
  doc.text(`PIN: ${ctx.address.postalCode}`, marginX, y)

  y += 35
  doc.setLineWidth(1)
  doc.line(marginX, y, 370, y)

  y += 25
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`Order ID: #${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}`, marginX, y)
  y += 18
  doc.text(`Courier: ${ctx.courierPartner ?? "Not yet assigned"}`, marginX, y)
  y += 18
  doc.text(`Payment: ${ctx.paymentMethod}`, marginX, y)

  y += 30
  const barcodeValue = ctx.trackingNumber ?? ctx.orderId
  const barcodeDataUrl = generateBarcodeDataUrl(barcodeValue)
  doc.addImage(barcodeDataUrl, "PNG", marginX, y, 340, 70)

  doc.save(`shipping-label-${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}.pdf`)
}
