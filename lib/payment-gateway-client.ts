"use client"

import { loadRazorpayCheckoutScript } from "@/lib/razorpay-checkout-script"
import type { RoutedPaymentOrder } from "@/lib/checkout-client"

/**
 * The one place that knows how to actually open each gateway's own checkout
 * flow — dispatches purely on RoutedPaymentOrder.gatewayId, which
 * app/checkout/page.tsx never renders as text anywhere; the customer only
 * ever sees the instrument (UPI/Cards/...) they picked, never a gateway
 * name. Razorpay/Cashfree open an in-page modal/SDK and resolve here with
 * the proof-of-payment payload verify() needs; every other gateway
 * (Stripe/PayPal/PhonePe/PayU) redirects the browser away to its own hosted
 * page and back — those never resolve this promise, so
 * app/checkout/page.tsx persists the pending payment to sessionStorage
 * before calling this and resumes verification on return instead (see
 * PENDING_PAYMENT_KEY there).
 */
export interface LaunchResult {
  ok: boolean
  payload: Record<string, string>
  error?: string
}

export async function launchGateway(order: RoutedPaymentOrder, prefill: { name: string; email: string; phone: string }): Promise<LaunchResult> {
  switch (order.gatewayId) {
    case "razorpay":
      return launchRazorpay(order, prefill)
    case "cashfree":
      return launchCashfree(order)
    case "stripe":
      redirectTo(order.clientParams.checkoutUrl as string)
      return { ok: false, payload: {} } // unreachable — navigation already left the page
    case "paypal":
      redirectTo(order.clientParams.approveUrl as string)
      return { ok: false, payload: {} }
    case "phonepe":
      redirectTo(order.clientParams.redirectUrl as string)
      return { ok: false, payload: {} }
    case "payu":
      submitPayuForm(order.clientParams as { actionUrl: string; fields: Record<string, string> })
      return { ok: false, payload: {} }
  }
}

function redirectTo(url: string) {
  window.location.href = url
}

function launchRazorpay(order: RoutedPaymentOrder, prefill: { name: string; email: string; phone: string }): Promise<LaunchResult> {
  const params = order.clientParams as {
    keyId: string
    amount: number
    currency: string
    orderId: string
    method: Record<string, boolean>
  }

  return loadRazorpayCheckoutScript().then(
    () =>
      new Promise<LaunchResult>((resolve) => {
        const RazorpayCheckout = (window as any).Razorpay
        const rzp = new RazorpayCheckout({
          key: params.keyId,
          amount: params.amount,
          currency: params.currency,
          order_id: params.orderId,
          name: "IXOFLORA",
          description: "Order payment",
          method: params.method,
          prefill: { name: prefill.name, email: prefill.email, contact: prefill.phone },
          handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) =>
            resolve({ ok: true, payload: { razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature } }),
          modal: { ondismiss: () => resolve({ ok: false, payload: {}, error: "Payment cancelled." }) },
        })
        rzp.on("payment.failed", (response: { error: { description: string } }) =>
          resolve({ ok: false, payload: {}, error: `Payment failed: ${response.error.description}` }),
        )
        rzp.open()
      }),
    () => ({ ok: false, payload: {}, error: "Couldn't load the payment gateway. Please try again." }),
  )
}

let cashfreeSdkPromise: Promise<any> | null = null

function loadCashfreeSdk(): Promise<any> {
  if (cashfreeSdkPromise) return cashfreeSdkPromise
  cashfreeSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js"
    script.onload = () => resolve((window as any).Cashfree)
    script.onerror = () => reject(new Error("Failed to load Cashfree checkout script."))
    document.body.appendChild(script)
  })
  return cashfreeSdkPromise
}

async function launchCashfree(order: RoutedPaymentOrder): Promise<LaunchResult> {
  const params = order.clientParams as { paymentSessionId: string; environment: "live" | "sandbox" }
  try {
    const Cashfree = await loadCashfreeSdk()
    const cashfree = await Cashfree({ mode: params.environment === "live" ? "production" : "sandbox" })
    // redirectTarget "_self" — a full-page redirect to Cashfree's hosted
    // checkout, same as every other non-Razorpay gateway here, rather than
    // building a custom modal mount point for the Drop-in's other modes.
    await cashfree.checkout({ paymentSessionId: params.paymentSessionId, redirectTarget: "_self" })
    return { ok: false, payload: {} } // unreachable — navigation already left the page
  } catch (error) {
    return { ok: false, payload: {}, error: error instanceof Error ? error.message : "Couldn't load the payment gateway. Please try again." }
  }
}

function submitPayuForm(clientParams: { actionUrl: string; fields: Record<string, string> }) {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = clientParams.actionUrl
  for (const [key, value] of Object.entries(clientParams.fields)) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = key
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}
