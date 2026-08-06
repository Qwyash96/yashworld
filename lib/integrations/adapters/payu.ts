import "server-only"
import { randomUUID } from "crypto"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific gateway. PayU has no zero-argument "ping" endpoint, so
// verification piggybacks on the documented Verify Payment API
// (https://docs.payu.in/reference/verify_payment_api) with a random,
// guaranteed-nonexistent transaction ID — a valid key+salt pair returns a
// "transaction not found"-style response, while an invalid key is rejected
// outright. Confirm this distinction still holds against PayU's current
// docs before enabling in production.
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://info.payu.in/merchant/postservice?form=2" : "https://test.payu.in/merchant/postservice?form=2"
}

// The hosted checkout page the browser form-posts to — a different host
// from the server-to-server postservice API above.
function checkoutUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://secure.payu.in/_payment" : "https://sandboxsecure.payu.in/_payment"
}

interface PayuTransactionDetail {
  status?: string
  amt?: string
  mihpayid?: string
}

export const payuAdapter: IntegrationAdapter = {
  id: "payu",
  name: "PayU",
  category: "payment",
  description: "India payment gateway — UPI, cards, net banking.",
  credentialFields: [
    { key: "merchantKey", label: "Merchant Key", type: "text", required: true },
    { key: "salt", label: "Salt", type: "password", required: true },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    if (!merchantKey || !salt) return { ok: false, message: "Merchant Key and Salt are required.", health: "unknown" }

    const command = "verify_payment"
    const var1 = `probe-${randomUUID()}`
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${var1}|${salt}`).digest("hex")

    try {
      const response = await fetch(baseUrl(environment), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: merchantKey, command, var1, hash }).toString(),
      })
      const body = await response.json().catch(() => ({}))
      // status 0 with an "Invalid key" style message means the key itself
      // was rejected; anything else (including "transaction not found" for
      // our deliberately-fake var1) means the key/salt pair authenticated.
      const msg = String(body?.msg ?? "").toLowerCase()
      if (!response.ok || msg.includes("invalid key") || msg.includes("invalid hash")) {
        return { ok: false, message: body?.msg ?? "PayU rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to PayU successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach PayU.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "PayU Verify Payment API authenticated successfully." : result.message }
  },

  // No API call to "create" an order — PayU's classic integration is a
  // hash-signed browser form-post straight to its hosted checkout page.
  // clientParams carries the whole form for lib/payment-gateway-client.ts
  // to build and submit.
  async createPaymentOrder(credentials, environment, input) {
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    const txnid = input.receiptId
    const amount = (input.amountPaise / 100).toFixed(2)
    const productinfo = "Order Payment"
    const firstname = input.buyerName || "Customer"
    const hash = createHash("sha512")
      .update(`${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${input.buyerEmail}|||||||||||${salt}`)
      .digest("hex")

    return {
      gatewayOrderId: txnid,
      clientParams: {
        actionUrl: checkoutUrl(environment),
        fields: {
          key: merchantKey,
          txnid,
          amount,
          productinfo,
          firstname,
          email: input.buyerEmail,
          phone: input.buyerPhone,
          surl: input.returnUrl,
          furl: input.returnUrl,
          hash,
        },
      },
    }
  },

  async verifyPayment(credentials, environment, input) {
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    const command = "verify_payment"
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${input.gatewayOrderId}|${salt}`).digest("hex")

    const response = await fetch(baseUrl(environment), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: merchantKey, command, var1: input.gatewayOrderId, hash }).toString(),
    })
    const body = await response.json().catch(() => ({}))
    const detail = body?.transaction_details?.[input.gatewayOrderId] as PayuTransactionDetail | undefined
    if (!response.ok || !detail) {
      return { ok: false, gatewayPaymentId: "", status: "failed", message: "Transaction not found." }
    }
    const gatewayPaymentId = detail.mihpayid ?? ""
    if (detail.status !== "success") {
      return { ok: false, gatewayPaymentId, status: detail.status === "failure" ? "failed" : "pending", message: `Status: ${detail.status}.` }
    }
    const paidPaise = Math.round(Number(detail.amt ?? 0) * 100)
    if (paidPaise !== input.expectedAmountPaise) {
      return { ok: false, gatewayPaymentId, status: "failed", message: "Paid amount does not match the order total." }
    }
    return { ok: true, gatewayPaymentId, status: "captured" }
  },

  async refundPayment(credentials, environment, input) {
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    const command = "cancel_refund_transaction"
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${input.gatewayPaymentId}|${salt}`).digest("hex")

    const response = await fetch(baseUrl(environment), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: merchantKey,
        command,
        var1: input.gatewayPaymentId,
        var3: (input.amountPaise / 100).toFixed(2),
        hash,
      }).toString(),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body.status !== 1) return { ok: false, message: body?.msg ?? "PayU refund failed." }
    return { ok: true, gatewayRefundId: body.request_id !== undefined ? String(body.request_id) : undefined, message: "Refund issued." }
  },

  async syncPaymentStatus(credentials, environment, input) {
    if (!input.gatewayOrderId) return { status: "unknown" }
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    const command = "verify_payment"
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${input.gatewayOrderId}|${salt}`).digest("hex")
    const response = await fetch(baseUrl(environment), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: merchantKey, command, var1: input.gatewayOrderId, hash }).toString(),
    })
    const body = await response.json().catch(() => ({}))
    const detail = body?.transaction_details?.[input.gatewayOrderId] as PayuTransactionDetail | undefined
    if (!response.ok || !detail) return { status: "unknown" }
    const status = detail.status === "success" ? "captured" : detail.status === "failure" ? "failed" : "pending"
    return { status, gatewayPaymentId: detail.mihpayid }
  },
}
