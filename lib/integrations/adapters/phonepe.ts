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
    void rawBody
    return { ok: true, status: 200, message: "Callback authorization verified." }
  },
}
