import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific gateway, v2 OAuth flow — PhonePe has changed their PG API
// shape more than once. Verify the exact token-endpoint host against
// https://developer.phonepe.com before enabling in production.
function tokenUrl(environment: "live" | "sandbox") {
  return environment === "live"
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
}

// The Checkout v2 host is separate from the OAuth token host above. Same
// "verify against current docs" caveat applies.
function payBaseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://api.phonepe.com/apis/pg" : "https://api-preprod.phonepe.com/apis/pg-sandbox"
}

async function fetchAccessToken(credentials: Record<string, string>, environment: "live" | "sandbox") {
  const response = await fetch(tokenUrl(environment), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_version: credentials.clientVersion,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) throw new Error(body?.message ?? "PhonePe OAuth token fetch failed.")
  return body.access_token as string
}

export const phonepeAdapter: IntegrationAdapter = {
  id: "phonepe",
  name: "PhonePe PG",
  category: "payment",
  description: "India payment gateway — UPI, cards, PhonePe wallet.",
  credentialFields: [
    { key: "clientId", label: "Client ID", type: "text", required: true },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true },
    { key: "clientVersion", label: "Client Version", type: "text", required: true, placeholder: "1" },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { clientId, clientSecret, clientVersion } = credentials
    if (!clientId || !clientSecret || !clientVersion) {
      return { ok: false, message: "Client ID, Client Secret and Client Version are all required.", health: "unknown" }
    }
    try {
      const response = await fetch(tokenUrl(environment), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_version: clientVersion,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }).toString(),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.access_token) {
        return { ok: false, message: body?.message ?? "PhonePe rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to PhonePe successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach PhonePe.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "PhonePe OAuth token fetch succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    // PhonePe's server-to-server callback is authenticated with a
    // SHA256(username:password) checksum configured in the PhonePe
    // dashboard, sent as the Authorization header — not a per-request HMAC
    // of the body. clientSecret doubles as that shared value here.
    const { createHash, timingSafeEqual } = await import("crypto")
    const authorization = headers["authorization"]
    if (!authorization) return { ok: false, status: 400, message: "Missing Authorization header." }
    if (!credentials.clientSecret) return { ok: false, status: 503, message: "Client Secret isn't configured." }

    const computed = createHash("sha256").update(credentials.clientSecret).digest("hex")
    const a = Buffer.from(computed)
    const b = Buffer.from(authorization)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid callback authorization." }
    }

    const event = JSON.parse(rawBody) as { payload?: { merchantOrderId?: string; state?: string } }
    const gatewayOrderId = event.payload?.merchantOrderId
    const newStatus = event.payload?.state === "COMPLETED" ? "Paid" : event.payload?.state === "FAILED" ? "Failed" : null
    if (gatewayOrderId && newStatus) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      const matches = await db.collection("orders").where("gatewayOrderId", "==", gatewayOrderId).limit(1).get()
      if (!matches.empty) await matches.docs[0]!.ref.update({ paymentStatus: newStatus })
    }

    return { ok: true, status: 200, message: "Callback authorization verified." }
  },

  async createPaymentOrder(credentials, environment, input) {
    const token = await fetchAccessToken(credentials, environment)
    const response = await fetch(`${payBaseUrl(environment)}/checkout/v2/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` },
      body: JSON.stringify({
        merchantOrderId: input.receiptId,
        amount: input.amountPaise,
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "Order payment",
          merchantUrls: { redirectUrl: input.returnUrl },
        },
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.redirectUrl) throw new Error(body?.message ?? "PhonePe order creation failed.")
    return {
      gatewayOrderId: input.receiptId,
      clientParams: { redirectUrl: body.redirectUrl },
    }
  },

  async verifyPayment(credentials, environment, input) {
    const token = await fetchAccessToken(credentials, environment)
    const response = await fetch(`${payBaseUrl(environment)}/checkout/v2/order/${input.gatewayOrderId}/status`, {
      headers: { Authorization: `O-Bearer ${token}` },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, gatewayPaymentId: "", status: "failed", message: body?.message ?? "PhonePe status check failed." }
    }
    const gatewayPaymentId = body.paymentDetails?.[0]?.transactionId ?? input.gatewayOrderId
    if (body.state !== "COMPLETED") {
      return { ok: false, gatewayPaymentId, status: body.state === "FAILED" ? "failed" : "pending", message: `Payment state: ${body.state}.` }
    }
    if (Number(body.amount) !== input.expectedAmountPaise) {
      return { ok: false, gatewayPaymentId, status: "failed", message: "Paid amount does not match the order total." }
    }
    return { ok: true, gatewayPaymentId, status: "captured" }
  },

  async refundPayment(credentials, environment, input) {
    const token = await fetchAccessToken(credentials, environment)
    const response = await fetch(`${payBaseUrl(environment)}/payments/v2/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` },
      body: JSON.stringify({
        merchantRefundId: `refund_${Date.now()}`,
        originalMerchantOrderId: input.gatewayOrderId,
        amount: input.amountPaise,
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: body?.message ?? "PhonePe refund failed." }
    return { ok: true, gatewayRefundId: body.refundId, message: "Refund issued." }
  },

  async syncPaymentStatus(credentials, environment, input) {
    if (!input.gatewayOrderId) return { status: "unknown" }
    try {
      const token = await fetchAccessToken(credentials, environment)
      const response = await fetch(`${payBaseUrl(environment)}/checkout/v2/order/${input.gatewayOrderId}/status`, {
        headers: { Authorization: `O-Bearer ${token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) return { status: "unknown" }
      const status = body.state === "COMPLETED" ? "captured" : body.state === "FAILED" ? "failed" : body.state === "REFUNDED" ? "refunded" : "pending"
      return { status, gatewayPaymentId: body.paymentDetails?.[0]?.transactionId }
    } catch {
      return { status: "unknown" }
    }
  },
}
