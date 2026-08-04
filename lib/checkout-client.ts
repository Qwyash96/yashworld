import { auth } from "@/services/firebase/client"
import type { ShippingMethod } from "@/types/order"
import type { PublicCheckoutConfig } from "@/types/checkout-config"

export interface CheckoutItemInput {
  productId: string
  quantity: number
}

export interface CheckoutAddressInput {
  fullName: string
  line1: string
  line2?: string
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

export async function createRazorpayOrder(input: {
  items: CheckoutItemInput[]
  shippingMethod: ShippingMethod
  couponCode?: string
}): Promise<
  | {
      ok: true
      razorpayOrderId: string
      amount: number
      currency: string
      keyId: string
      methods: PublicCheckoutConfig["methods"]
    }
  | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/payments/razorpay/create-order", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  })
  const result = await parseResult<{
    razorpayOrderId: string
    amount: number
    currency: string
    keyId: string
    methods: PublicCheckoutConfig["methods"]
  }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function verifyRazorpayPayment(input: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  items: CheckoutItemInput[]
  contactEmail: string
  shippingMethod: ShippingMethod
  shippingAddress: CheckoutAddressInput
  couponCode?: string
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/payments/razorpay/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  })
  const result = await parseResult<{ orderId: string }>(response)
  if (!result.ok) return result
  return { ok: true, orderId: result.data.orderId }
}

let razorpayScriptPromise: Promise<void> | null = null

/** Injects the Razorpay Checkout.js script tag once, however many times this is called. */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).Razorpay) {
    return Promise.resolve()
  }
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."))
    document.body.appendChild(script)
  })
  return razorpayScriptPromise
}
