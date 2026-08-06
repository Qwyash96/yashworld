import type { SellerOrder } from "@/types/order"
import type { SellerFacingOrder } from "@/lib/seller-order-redaction"

/** Everything every document generator (invoice/shipping-label/packing-slip)
 * needs — assembled once on the seller order detail page from data already
 * loaded there, so each generator stays a pure function over real data.
 * Customer phone/email are deliberately NOT part of this shape — see
 * app/seller/orders/[id]/page.tsx's own doc comment on why they're excluded
 * from every seller-facing surface. */
export interface OrderDocumentContext {
  orderId: string
  createdAt: string
  sellerShopName: string
  customerName: string
  address: {
    line1: string
    line2?: string
    landmark?: string
    city: string
    state: string
    postalCode: string
  }
  items: { name: string; sku: string; quantity: number; price: number; originalPrice?: number }[]
  subtotal: number
  discount: number
  commissionAmount: number
  payoutAmount: number
  deliveryCharge: number
  total: number
  paymentMethod: string
  paymentStatus: string
  courierPartner?: string
  trackingNumber?: string
}

export function buildOrderDocumentContext(
  order: SellerFacingOrder,
  sellerOrder: SellerOrder,
  sellerShopName: string,
  productNames: Map<string, string>,
): OrderDocumentContext {
  const subtotal = sellerOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const discount = sellerOrder.items.reduce(
    (sum, i) => sum + ((i.originalPrice ?? i.price) - i.price) * i.quantity,
    0,
  )

  return {
    orderId: order.id,
    createdAt: order.createdAt,
    sellerShopName,
    customerName: order.shippingAddress.fullName,
    address: {
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2,
      landmark: order.shippingAddress.landmark,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
    },
    items: sellerOrder.items.map((i) => ({
      name: productNames.get(i.productId) ?? i.productId,
      sku: i.productId,
      quantity: i.quantity,
      price: i.price,
      originalPrice: i.originalPrice,
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    commissionAmount: sellerOrder.commissionAmount,
    payoutAmount: sellerOrder.payoutAmount,
    deliveryCharge: order.totals.shipping,
    total: Math.round((subtotal - discount + order.totals.shipping) * 100) / 100,
    // Invoices/packing slips can end up in the customer's hands (shipped
    // with the package) — never name a specific gateway there, only
    // whether the seller needs to collect cash at delivery.
    paymentMethod: order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment (Prepaid)",
    paymentStatus: order.paymentStatus,
    courierPartner: sellerOrder.courierPartner,
    trackingNumber: sellerOrder.trackingNumber,
  }
}
