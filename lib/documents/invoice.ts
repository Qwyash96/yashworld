import { jsPDF } from "jspdf"
import { formatPrice } from "@/lib/products"
import type { OrderDocumentContext } from "@/lib/documents/order-document-context"

/** Real invoice, built from the order's actual line items/amounts — no
 * placeholder rows. Downloads directly (no server round-trip, no storage). */
export function generateInvoicePdf(ctx: OrderDocumentContext): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("TAX INVOICE", marginX, y)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(ctx.sellerShopName, 555 - marginX, y, { align: "right" })

  y += 25
  doc.setDrawColor(200)
  doc.line(marginX, y, 555, y)

  y += 25
  doc.setFontSize(10)
  doc.text(`Order ID: #${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}`, marginX, y)
  doc.text(`Order Date: ${new Date(ctx.createdAt).toLocaleString()}`, 555 - marginX, y, { align: "right" })

  y += 30
  doc.setFont("helvetica", "bold")
  doc.text("Bill To", marginX, y)
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
  const headers = ["Item", "SKU", "Qty", "Price", "Total"]
  const colX = [marginX, 260, 350, 400, 480]
  headers.forEach((h, i) => doc.text(h, colX[i]!, y))
  y += 8
  doc.line(marginX, y, 555, y)
  y += 15

  doc.setFont("helvetica", "normal")
  for (const item of ctx.items) {
    doc.text(item.name.slice(0, 30), colX[0]!, y)
    doc.text(item.sku.slice(0, 12), colX[1]!, y)
    doc.text(String(item.quantity), colX[2]!, y)
    doc.text(formatPrice(item.price), colX[3]!, y)
    doc.text(formatPrice(item.price * item.quantity), colX[4]!, y)
    y += 18
  }

  y += 10
  doc.line(350, y, 555, y)
  y += 18
  doc.text("Subtotal", 400, y)
  doc.text(formatPrice(ctx.subtotal), 555, y, { align: "right" })
  if (ctx.discount > 0) {
    y += 16
    doc.text("Discount", 400, y)
    doc.text(`-${formatPrice(ctx.discount)}`, 555, y, { align: "right" })
  }
  y += 16
  doc.text("Delivery Charge", 400, y)
  doc.text(formatPrice(ctx.deliveryCharge), 555, y, { align: "right" })
  y += 18
  doc.setFont("helvetica", "bold")
  doc.text("Total", 400, y)
  doc.text(formatPrice(ctx.total), 555, y, { align: "right" })

  y += 30
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Payment Method: ${ctx.paymentMethod}`, marginX, y)
  y += 14
  doc.text(`Payment Status: ${ctx.paymentStatus}`, marginX, y)

  doc.save(`invoice-${ctx.orderNumber ?? ctx.orderId.slice(0, 8)}.pdf`)
}
