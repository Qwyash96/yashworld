import { auth } from "@/services/firebase/client"
import type { PaymentGatewayId, ShippingMethod } from "@/types/order"
import type { PaymentMethodFlags, PublicCheckoutConfig } from "@/types/checkout-config"

// lib/integrations/types.ts is "server-only" (can't be imported into this
// client-bundled file) — PaymentMethodFlags' own keys are the identical
// buyer-facing instrument vocabulary, so this is derived from there instead.
export type PaymentInstrument = keyof PaymentMethodFlags

export interface CheckoutItemInput {
  productId: string
  quantity: number
}

export interface CheckoutAddressInput {
  fullName: string
  line1: string
  line2?: string
  landmark?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function parseResult<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Request failed." }
  return { ok: true, data: body as T }
}

/** Public, unauthenticated — which payment methods to show at checkout, admin-controlled. */
export async function fetchCheckoutConfig(): Promise<
  { ok: true; config: PublicCheckoutConfig } | { ok: false; error: string }
> {
  const response = await fetch("/api/checkout/config")
  const result = await parseResult<PublicCheckoutConfig>(response)
  if (!result.ok) return result
  return { ok: true, config: result.data }
}

export interface OrderPricingPreview {
  subtotal: number
  discount: number
  shipping: number
  total: number
  appliedCouponCode: string | null
}

/** Read-only, live preview of the trusted pricing engine — shows the real
 * discount/coupon effect before payment, without duplicating any pricing
 * math client-side. */
export async function previewOrderPricing(input: {
  items: CheckoutItemInput[]
  shippingMethod: ShippingMethod
  couponCode?: string
}): Promise<{ ok: true; preview: OrderPricingPreview } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/checkout/price-preview", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<OrderPricingPreview>(response)
  if (!result.ok) return result
  return { ok: true, preview: result.data }
}

export async function placeCodOrder(input: {
  items: CheckoutItemInput[]
  contactEmail: string
  shippingMethod: ShippingMethod
  shippingAddress: CheckoutAddressInput
  couponCode?: string
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/checkout/cod", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ orderId: string }>(response)
  if (!result.ok) return result
  return { ok: true, orderId: result.data.orderId }
}

export interface RoutedPaymentOrder {
  /** Server-internal — which gateway the router actually chose. Never
   * rendered as text; lib/payment-gateway-client.ts switches on it purely
   * to know which checkout SDK/flow to invoke. */
  gatewayId: PaymentGatewayId
  gatewayOrderId: string
  clientParams: Record<string, unknown>
  amount: number
  currency: string
}

/** Gateway-agnostic — the customer picks an instrument (UPI/Cards/Net
 * Banking/Wallet/EMI), never a gateway. lib/payment-router.ts decides which
 * enabled+connected gateway processes it (with automatic fallback), server-side. */
export async function createPaymentOrder(input: {
  items: CheckoutItemInput[]
  shippingMethod: ShippingMethod
  method: PaymentInstrument
  contactEmail: string
  buyerName: string
  buyerPhone: string
  couponCode?: string
}): Promise<{ ok: true; order: RoutedPaymentOrder } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/payments/create-order", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  })
  const result = await parseResult<RoutedPaymentOrder>(response)
  if (!result.ok) return result
  return { ok: true, order: result.data }
}

export async function verifyPayment(input: {
  gatewayId: PaymentGatewayId
  gatewayOrderId: string
  payload: Record<string, string>
  items: CheckoutItemInput[]
  contactEmail: string
  shippingMethod: ShippingMethod
  shippingAddress: CheckoutAddressInput
  couponCode?: string
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/payments/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  })
  const result = await parseResult<{ orderId: string }>(response)
  if (!result.ok) return result
  return { ok: true, orderId: result.data.orderId }
}
