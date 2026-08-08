import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { tryAutoGenerateAwb, type AutoAwbResult } from "@/lib/shipping-service"
import type { Order } from "@/types/order"
import type { Product } from "@/types/product"

export type AutoShipmentAttempt = { ok: true; awb: AutoAwbResult } | { ok: false; error: string }

/**
 * The one place that turns an accepted order into a real shipment — called
 * right after app/api/seller/orders/[id]/status accepts a "Pending" order
 * (never seller-triggered directly; the seller's only action is Accept).
 * Deliberately non-transactional (a Firestore transaction should never wrap
 * an external network call — see lib/shipping-service.ts's own doc comment
 * on tryAutoGenerateAwb, which this wraps): the caller performs the actual
 * Firestore write afterward, using buildAutoShippedSellerOrder on success or
 * a plain shippingSetupError field update on failure. Returns a structured
 * failure rather than throwing so the caller can leave the order at
 * "Accepted" with a real, specific reason instead of a fake AWB/pickup time
 * (see the ERROR HANDLING requirement this exists to satisfy).
 */
export async function attemptAutoShipment(order: Order, sellerId: string): Promise<AutoShipmentAttempt> {
  const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
  if (!sellerOrder) return { ok: false, error: "You don't have any items on this order." }

  try {
    const db = getAdminDb()
    const productSnaps = await db.getAll(...sellerOrder.items.map((item) => db.collection("products").doc(item.productId)))
    const items = sellerOrder.items.map((item, i) => ({
      productId: item.productId,
      name: (productSnaps[i].data() as Product | undefined)?.name ?? item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    }))
    const subTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

    const awb = await tryAutoGenerateAwb({
      // One order can hold several sellers' shipments — each courier needs a
      // unique order_id per shipment, so this seller's uid is appended. Also
      // relied on to look an order back up from an inbound webhook — see
      // lib/order-tracking-sync.ts's decomposeShipmentReference.
      orderId: `${order.id}-${sellerId}`,
      pickupLocationName: "",
      paymentMethod: order.paymentMethod,
      subTotal,
      customerName: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      email: order.contactEmail,
      addressLine1: order.shippingAddress.line1,
      addressLine2: order.shippingAddress.line2,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      items,
    })

    if (!awb) {
      return { ok: false, error: "No shipping provider is currently connected and enabled for automatic shipment creation." }
    }
    return { ok: true, awb }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create the shipment with the configured shipping provider." }
  }
}
