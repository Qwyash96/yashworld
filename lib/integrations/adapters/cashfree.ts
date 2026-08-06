import "server-only"
import type { IntegrationAdapter, PaymentInstrument } from "@/lib/integrations/types"

// India-specific gateway — endpoint/header shape confirmed against Cashfree's
// published API reference, but exact `x-api-version` values change over
// time. Verify against https://docs.cashfree.com before enabling in
// production.
const API_VERSION = "2023-08-01"

function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com"
}

function authHeaders(clientId: string, clientSecret: string) {
  return {
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
  }
}

// Restricts the Cashfree Drop-in widget to just the one instrument the
// customer already picked on our own checkout page — see
// https://docs.cashfree.com before enabling in production, this comma-list
// shape is the documented one as of API_VERSION above but Cashfree has
// changed instrument codes before.
function cashfreePaymentMethodGroup(method: PaymentInstrument): string {
  switch (method) {
    case "upi":
      return "upi"
    case "cards":
      return "cc,dc"
    case "netbanking":
      return "nb"
    case "wallet":
      return "app"
    case "emi":
      return "ccc,dccc"
    default:
      return "cc,dc,upi,nb"
  }
}

interface CashfreePaymentAttempt {
  cf_payment_id?: string | number
  payment_status?: string
  payment_amount?: number
}

export const cashfreeAdapter: IntegrationAdapter = {
  id: "cashfree",
  name: "Cashfree",
  category: "payment",
  description: "India payment gateway — UPI, cards, net banking, wallets.",
  credentialFields: [
    { key: "clientId", label: "App ID", type: "text", required: true },
    { key: "clientSecret", label: "Secret Key", type: "password", required: true },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { clientId, clientSecret } = credentials
    if (!clientId || !clientSecret) return { ok: false, message: "App ID and Secret Key are required.", health: "unknown" }
    try {
      const response = await fetch(`${baseUrl(environment)}/pg/orders?limit=1`, {
        headers: {
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-api-version": API_VERSION,
        },
      })
      // 401/403 means the credential pair itself was rejected. Any other
      // status (including a 4xx on the list query's own params) means the
      // credentials were accepted and authenticated.
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => ({}))
        return { ok: false, message: body?.message ?? "Cashfree rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Cashfree successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Cashfree.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Cashfree API reachable — GET /pg/orders authenticated." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const { createHmac, timingSafeEqual } = await import("crypto")
    const signature = headers["x-webhook-signature"]
    const timestamp = headers["x-webhook-timestamp"]
    if (!signature || !timestamp) return { ok: false, status: 400, message: "Missing webhook signature headers." }
    if (!credentials.clientSecret) return { ok: false, status: 503, message: "Secret Key isn't configured." }

    const computed = createHmac("sha256", credentials.clientSecret).update(`${timestamp}${rawBody}`).digest("base64")
    const a = Buffer.from(computed)
    const b = Buffer.from(signature)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }

    const event = JSON.parse(rawBody) as {
      type?: string
      data?: { order?: { order_id?: string }; payment?: { payment_status?: string } }
    }
    const gatewayOrderId = event.data?.order?.order_id
    const paymentStatus = event.data?.payment?.payment_status
    const newStatus = paymentStatus === "SUCCESS" ? "Paid" : paymentStatus === "FAILED" ? "Failed" : null

    if (gatewayOrderId && newStatus) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      const matches = await db.collection("orders").where("gatewayOrderId", "==", gatewayOrderId).limit(1).get()
      if (!matches.empty) await matches.docs[0]!.ref.update({ paymentStatus: newStatus })
    }

    return { ok: true, status: 200, message: "Webhook signature verified." }
  },

  async createPaymentOrder(credentials, environment, input) {
    const { clientId, clientSecret } = credentials
    const response = await fetch(`${baseUrl(environment)}/pg/orders`, {
      method: "POST",
      headers: authHeaders(clientId, clientSecret),
      body: JSON.stringify({
        order_id: input.receiptId,
        order_amount: Number((input.amountPaise / 100).toFixed(2)),
        order_currency: input.currency,
        customer_details: {
          customer_id: input.buyerId,
          customer_email: input.buyerEmail,
          customer_phone: input.buyerPhone,
        },
        order_meta: {
          return_url: `${input.returnUrl}?order_id={order_id}`,
          payment_methods: cashfreePaymentMethodGroup(input.method),
        },
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.payment_session_id) {
      throw new Error(body?.message ?? "Cashfree order creation failed.")
    }
    return {
      gatewayOrderId: body.order_id ?? input.receiptId,
      clientParams: { paymentSessionId: body.payment_session_id, orderId: body.order_id ?? input.receiptId, environment },
    }
  },

  async verifyPayment(credentials, environment, input) {
    const { clientId, clientSecret } = credentials
    const response = await fetch(`${baseUrl(environment)}/pg/orders/${input.gatewayOrderId}/payments`, {
      headers: authHeaders(clientId, clientSecret),
    })
    const attempts = (await response.json().catch(() => [])) as CashfreePaymentAttempt[]
    const latest = Array.isArray(attempts) ? attempts[0] : undefined
    if (!response.ok || !latest) {
      return { ok: false, gatewayPaymentId: "", status: "failed", message: "No payment attempt found for this order." }
    }
    const gatewayPaymentId = String(latest.cf_payment_id ?? "")
    if (latest.payment_status !== "SUCCESS") {
      return { ok: false, gatewayPaymentId, status: latest.payment_status === "FAILED" ? "failed" : "pending", message: `Payment status: ${latest.payment_status}.` }
    }
    const paidPaise = Math.round((latest.payment_amount ?? 0) * 100)
    if (paidPaise !== input.expectedAmountPaise) {
      return { ok: false, gatewayPaymentId, status: "failed", message: "Paid amount does not match the order total." }
    }
    return { ok: true, gatewayPaymentId, status: "captured" }
  },

  async refundPayment(credentials, environment, input) {
    const { clientId, clientSecret } = credentials
    const response = await fetch(`${baseUrl(environment)}/pg/orders/${input.gatewayOrderId}/refunds`, {
      method: "POST",
      headers: authHeaders(clientId, clientSecret),
      body: JSON.stringify({
        refund_amount: Number((input.amountPaise / 100).toFixed(2)),
        refund_id: `refund_${Date.now()}`,
        refund_note: input.reason ?? "Refund",
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: body?.message ?? "Cashfree refund failed." }
    return { ok: true, gatewayRefundId: body.refund_id, message: "Refund issued." }
  },

  async syncPaymentStatus(credentials, environment, input) {
    if (!input.gatewayOrderId) return { status: "unknown" }
    const { clientId, clientSecret } = credentials
    const response = await fetch(`${baseUrl(environment)}/pg/orders/${input.gatewayOrderId}/payments`, {
      headers: authHeaders(clientId, clientSecret),
    })
    const attempts = (await response.json().catch(() => [])) as CashfreePaymentAttempt[]
    const latest = Array.isArray(attempts) ? attempts[0] : undefined
    if (!response.ok || !latest) return { status: "unknown" }
    const status =
      latest.payment_status === "SUCCESS" ? "captured" : latest.payment_status === "FAILED" ? "failed" : latest.payment_status === "REFUNDED" ? "refunded" : "pending"
    return { status, gatewayPaymentId: latest.cf_payment_id ? String(latest.cf_payment_id) : undefined }
  },
}
