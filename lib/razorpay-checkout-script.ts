// Shared by two independent Razorpay checkout.js consumers: the product
// checkout flow (lib/payment-gateway-client.ts, routed through
// lib/payment-router.ts) and the seller sponsored-ads promotion flow
// (app/seller/marketing/promote/page.tsx, app/api/ads/**) — a completely
// separate payment flow (seller pays the platform for ad promotion, not a
// buyer product-checkout) that stays hardcoded to Razorpay on purpose, out
// of scope for the multi-gateway router. Pulled out on its own so neither
// flow depends on the other's module.

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
