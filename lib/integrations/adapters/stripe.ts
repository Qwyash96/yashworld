import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

const SECRET_KEY_PATTERN = /^sk_(test|live)_[A-Za-z0-9]+$/

export const stripeAdapter: IntegrationAdapter = {
  id: "stripe",
  name: "Stripe",
  category: "payment",
  description: "Global card payments and billing.",
  credentialFields: [
    { key: "secretKey", label: "Secret Key", type: "password", required: true, placeholder: "sk_test_..." },
    { key: "publishableKey", label: "Publishable Key", type: "text", required: false, placeholder: "pk_test_..." },
    { key: "webhookSecret", label: "Webhook Signing Secret", type: "password", required: false, placeholder: "whsec_..." },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { secretKey } = credentials
    if (!secretKey) return { ok: false, message: "Secret Key is required.", health: "unknown" }
    if (!SECRET_KEY_PATTERN.test(secretKey)) {
      return { ok: false, message: "Secret Key doesn't look like a valid Stripe key (expected sk_test_... or sk_live_...).", health: "down" }
    }
    try {
      const response = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        return { ok: false, message: body?.error?.message ?? "Stripe rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Stripe successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Stripe.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Stripe API reachable — GET /v1/balance succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const { createHmac, timingSafeEqual } = await import("crypto")
    const signatureHeader = headers["stripe-signature"]
    if (!signatureHeader) return { ok: false, status: 400, message: "Missing Stripe-Signature header." }
    if (!credentials.webhookSecret) return { ok: false, status: 503, message: "Webhook signing secret isn't configured." }

    const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=") as [string, string]))
    const timestamp = parts.t
    const expectedSignature = parts.v1
    if (!timestamp || !expectedSignature) return { ok: false, status: 400, message: "Malformed Stripe-Signature header." }

    const computed = createHmac("sha256", credentials.webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex")
    const a = Buffer.from(computed)
    const b = Buffer.from(expectedSignature)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }

    const event = JSON.parse(rawBody) as { type?: string; data?: { object?: { id?: string } } }
    const gatewayOrderId = event.data?.object?.id
    const newStatus =
      event.type === "payment_intent.succeeded" ? "Paid" : event.type === "payment_intent.payment_failed" ? "Failed" : null

    if (gatewayOrderId && newStatus) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      const matches = await db.collection("orders").where("gatewayOrderId", "==", gatewayOrderId).limit(1).get()
      if (!matches.empty) await matches.docs[0]!.ref.update({ paymentStatus: newStatus })
    }

    return { ok: true, status: 200, message: "Webhook signature verified." }
  },

  // Uses Checkout Sessions (Stripe's own hosted-redirect quick-integration
  // path) rather than raw PaymentIntents + Elements — this app has no
  // custom embedded card-field UI, and Checkout Sessions fit the same
  // "redirect out, redirect back, verify server-side" pattern as
  // PhonePe/PayU/PayPal, kept consistent across every gateway that isn't
  // Razorpay's own in-page modal. Amounts are already in the smallest
  // currency unit (paise for INR) — matches Stripe's own convention for
  // non-zero-decimal currencies, no conversion needed.
  async createPaymentOrder(credentials, _environment, input) {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": input.currency.toLowerCase(),
        "line_items[0][price_data][product_data][name]": "Order Payment",
        "line_items[0][price_data][unit_amount]": String(input.amountPaise),
        "line_items[0][quantity]": "1",
        success_url: input.returnUrl,
        cancel_url: input.returnUrl,
        customer_email: input.buyerEmail,
        "metadata[buyerId]": input.buyerId,
        "metadata[receiptId]": input.receiptId,
      }).toString(),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.url) throw new Error(body?.error?.message ?? "Stripe Checkout Session creation failed.")
    return { gatewayOrderId: body.id, clientParams: { checkoutUrl: body.url } }
  },

  async verifyPayment(credentials, _environment, input) {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${input.gatewayOrderId}`, {
      headers: { Authorization: `Bearer ${credentials.secretKey}` },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, gatewayPaymentId: "", status: "failed", message: body?.error?.message ?? "Stripe Checkout Session lookup failed." }
    }
    const gatewayPaymentId = typeof body.payment_intent === "string" ? body.payment_intent : (body.payment_intent?.id ?? "")
    if (body.payment_status !== "paid") {
      return { ok: false, gatewayPaymentId, status: body.status === "expired" ? "failed" : "pending", message: `Checkout Session payment status: ${body.payment_status}.` }
    }
    if (Number(body.amount_total) !== input.expectedAmountPaise) {
      return { ok: false, gatewayPaymentId, status: "failed", message: "Paid amount does not match the order total." }
    }
    return { ok: true, gatewayPaymentId, status: "captured" }
  },

  async refundPayment(credentials, _environment, input) {
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        payment_intent: input.gatewayPaymentId,
        amount: String(input.amountPaise),
        ...(input.reason ? { "metadata[reason]": input.reason } : {}),
      }).toString(),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: body?.error?.message ?? "Stripe refund failed." }
    return { ok: true, gatewayRefundId: body.id, message: "Refund issued." }
  },

  async syncPaymentStatus(credentials, _environment, input) {
    if (!input.gatewayOrderId) return { status: "unknown" }
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${input.gatewayOrderId}`, {
      headers: { Authorization: `Bearer ${credentials.secretKey}` },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { status: "unknown" }
    const gatewayPaymentId = typeof body.payment_intent === "string" ? body.payment_intent : body.payment_intent?.id
    const status = body.payment_status === "paid" ? "captured" : body.status === "expired" ? "failed" : "pending"
    return { status, gatewayPaymentId }
  },
}
