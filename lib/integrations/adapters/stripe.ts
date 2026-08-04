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

    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
