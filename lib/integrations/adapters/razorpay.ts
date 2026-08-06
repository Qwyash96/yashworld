import "server-only"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import type { IntegrationAdapter, PaymentInstrument } from "@/lib/integrations/types"

const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{8,}$/

function razorpayMethodFlags(method: PaymentInstrument) {
  return {
    upi: method === "upi",
    card: method === "cards",
    netbanking: method === "netbanking",
    wallet: method === "wallet",
    emi: method === "emi",
    paylater: false,
  }
}

export const razorpayAdapter: IntegrationAdapter = {
  id: "razorpay",
  name: "Razorpay",
  category: "payment",
  description: "India's most widely used payment gateway — UPI, cards, net banking, wallets, EMI.",
  credentialFields: [
    { key: "keyId", label: "Key ID", type: "text", required: true, placeholder: "rzp_test_..." },
    { key: "keySecret", label: "Key Secret", type: "password", required: true },
    { key: "webhookSecret", label: "Webhook Secret", type: "password", required: false },
    { key: "paymentLink", label: "Payment Link (optional fallback)", type: "url", required: false, placeholder: "https://rzp.io/l/..." },
  ],
  // Checkout instruments (UPI/Cards/Net Banking/Wallet/EMI/COD) and the old
  // razorpayEnabled/codEnabled/defaultMethod flags used to live here — moved
  // to the gateway-agnostic Admin -> Payment Settings page
  // (platformSettings/paymentMethods, see types/platform-settings.ts) since
  // they're checkout concepts, not Razorpay credentials. "Is this gateway
  // usable" is now solely IntegrationConfig.enabled, the same field every
  // other adapter already uses.
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { keyId, keySecret } = credentials
    if (!keyId || !keySecret) return { ok: false, message: "Key ID and Key Secret are required.", health: "unknown" }
    if (!KEY_ID_PATTERN.test(keyId)) {
      return {
        ok: false,
        message: "Key ID doesn't look like a valid Razorpay key (expected rzp_test_... or rzp_live_...).",
        health: "down",
      }
    }
    try {
      await getRazorpayClient(keyId, keySecret).orders.all({ count: 1 })
      return { ok: true, message: "Connected to Razorpay successfully.", health: "healthy" }
    } catch (error) {
      const message = (error as { error?: { description?: string } })?.error?.description
      return { ok: false, message: message ?? "Razorpay rejected these credentials.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return {
      ok: result.ok,
      message: result.ok
        ? "Razorpay API reachable with these credentials. (\"Test Payment\" is a lightweight authenticated check, not a live checkout simulation.)"
        : result.message,
    }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const Razorpay = (await import("razorpay")).default
    const signature = headers["x-razorpay-signature"]
    if (!signature) return { ok: false, status: 400, message: "Missing signature." }
    if (!credentials.webhookSecret) return { ok: false, status: 503, message: "Webhook secret isn't configured." }

    const valid = Razorpay.validateWebhookSignature(rawBody, signature, credentials.webhookSecret)
    if (!valid) return { ok: false, status: 400, message: "Invalid webhook signature." }

    const event = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: { order_id?: string } } } }
    const razorpayOrderId = event.payload?.payment?.entity?.order_id
    const newStatus = event.event === "payment.captured" ? "Paid" : event.event === "payment.failed" ? "Failed" : null

    if (razorpayOrderId && newStatus) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      const matches = await db.collection("orders").where("razorpayOrderId", "==", razorpayOrderId).limit(1).get()
      if (!matches.empty) await matches.docs[0]!.ref.update({ paymentStatus: newStatus })
    }

    return { ok: true, status: 200, message: "Webhook processed." }
  },

  async createPaymentOrder(credentials, _environment, input) {
    const { keyId, keySecret } = credentials
    const order = await getRazorpayClient(keyId, keySecret).orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receiptId,
      notes: { buyerId: input.buyerId },
    })
    return {
      gatewayOrderId: order.id,
      clientParams: {
        keyId,
        amount: input.amountPaise,
        currency: input.currency,
        orderId: order.id,
        method: razorpayMethodFlags(input.method),
        prefill: { name: input.buyerName, email: input.buyerEmail, contact: input.buyerPhone },
      },
    }
  },

  async verifyPayment(credentials, _environment, input) {
    const Razorpay = (await import("razorpay")).default
    const { keySecret } = credentials
    const paymentId = input.payload.razorpay_payment_id
    const signature = input.payload.razorpay_signature
    if (!paymentId || !signature) {
      return { ok: false, gatewayPaymentId: "", status: "failed", message: "Missing payment id/signature." }
    }

    const signatureValid = Razorpay.validateWebhookSignature(`${input.gatewayOrderId}|${paymentId}`, signature, keySecret)
    if (!signatureValid) {
      return { ok: false, gatewayPaymentId: paymentId, status: "failed", message: "Payment signature verification failed." }
    }

    const payment = await getRazorpayClient(credentials.keyId, keySecret).payments.fetch(paymentId)
    if (payment.order_id !== input.gatewayOrderId) {
      return { ok: false, gatewayPaymentId: paymentId, status: "failed", message: "Payment does not match the order." }
    }
    if (payment.status !== "captured") {
      return { ok: false, gatewayPaymentId: paymentId, status: "pending", message: `Payment not captured (status: ${payment.status}).` }
    }
    if (Number(payment.amount) !== input.expectedAmountPaise) {
      return { ok: false, gatewayPaymentId: paymentId, status: "failed", message: "Paid amount does not match the order total." }
    }

    return { ok: true, gatewayPaymentId: paymentId, status: "captured" }
  },

  async refundPayment(credentials, _environment, input) {
    try {
      const refund = await getRazorpayClient(credentials.keyId, credentials.keySecret).payments.refund(input.gatewayPaymentId, {
        amount: input.amountPaise,
        notes: input.reason ? { reason: input.reason } : undefined,
      })
      return { ok: true, gatewayRefundId: refund.id, message: "Refund issued." }
    } catch (error) {
      const message = (error as { error?: { description?: string } })?.error?.description
      return { ok: false, message: message ?? "Razorpay refund failed." }
    }
  },

  async syncPaymentStatus(credentials, _environment, input) {
    if (!input.gatewayPaymentId) return { status: "unknown" }
    try {
      const payment = await getRazorpayClient(credentials.keyId, credentials.keySecret).payments.fetch(input.gatewayPaymentId)
      const status =
        payment.status === "captured"
          ? "captured"
          : payment.status === "refunded"
            ? "refunded"
            : payment.status === "failed"
              ? "failed"
              : "pending"
      return { status, gatewayPaymentId: payment.id }
    } catch {
      return { status: "unknown" }
    }
  },
}
