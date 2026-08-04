import "server-only"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import type { IntegrationAdapter } from "@/lib/integrations/types"

const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{8,}$/

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
  settingFields: [
    { key: "upi", label: "UPI", type: "boolean", default: false },
    { key: "cards", label: "Cards", type: "boolean", default: false },
    { key: "netbanking", label: "Net Banking", type: "boolean", default: false },
    { key: "wallet", label: "Wallet", type: "boolean", default: false },
    { key: "emi", label: "EMI", type: "boolean", default: false },
    { key: "cod", label: "Cash on Delivery (payment method)", type: "boolean", default: true },
    { key: "razorpayEnabled", label: "Enable Razorpay Checkout", type: "boolean", default: false },
    { key: "codEnabled", label: "Enable COD Checkout", type: "boolean", default: true },
    {
      key: "defaultMethod",
      label: "Default Payment Method",
      type: "select",
      options: [
        { value: "cod", label: "Cash on Delivery" },
        { value: "razorpay", label: "Razorpay" },
      ],
      default: "cod",
    },
  ],
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
}
