import "server-only"
import type { Address } from "@/types/user"
import type { Order } from "@/types/order"

/** The buyer address shape a seller is allowed to see — everything except
 * `phone`. Sellers need the delivery address to fulfil an order; they never
 * need the buyer's phone number, which the courier already receives
 * directly from the backend during AWB generation (lib/shiprocket-client.ts). */
export type SellerFacingAddress = Omit<Address, "phone">

/** The order shape returned to sellers by app/api/seller/orders/**  —
 * `shippingAddress.phone` and `contactEmail` are stripped server-side
 * before the JSON response is ever sent, so they never reach the seller's
 * browser (not just hidden by the UI). Omitting them from the TYPE too
 * means any seller-side code that tries to read `.phone` or `.contactEmail`
 * off this shape fails to compile, instead of silently reading `undefined`. */
export type SellerFacingOrder = Omit<Order, "shippingAddress" | "contactEmail"> & {
  shippingAddress: SellerFacingAddress
}

/** Strips buyer phone/email from a full Order before it's sent to a
 * seller-facing API response. Only Admin routes (app/api/admin/**) and the
 * buyer's own order routes may return the untouched Order. */
export function redactOrderForSeller(order: Order): SellerFacingOrder {
  const { contactEmail: _contactEmail, shippingAddress, ...rest } = order
  const { phone: _phone, ...restAddress } = shippingAddress
  void _contactEmail
  void _phone
  return { ...rest, shippingAddress: restAddress }
}
