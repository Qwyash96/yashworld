import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific gateway — endpoint/header shape confirmed against Cashfree's
// published API reference, but exact `x-api-version` values change over
// time. Verify against https://docs.cashfree.com before enabling in
// production.
const API_VERSION = "2023-08-01"

function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com"
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
    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
