import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Confirmed: Delhivery authenticates every request with a static
// `Authorization: Token <API_TOKEN>` header (no login call — the token
// itself is issued by Delhivery's Business Development team / developer
// portal). Verified here via the Pincode Serviceability endpoint, the
// lightest documented authenticated GET. Base host differs between staging
// and production per Delhivery's docs (staging-express vs track) — confirm
// against https://delhivery-express-api-doc.readme.io before enabling in
// production.
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://track.delhivery.com" : "https://staging-express.delhivery.com"
}

export const delhiveryAdapter: IntegrationAdapter = {
  id: "delhivery",
  name: "Delhivery",
  category: "shipping",
  description: "Pan-India logistics — AWB, pincode serviceability, tracking.",
  credentialFields: [{ key: "apiToken", label: "API Token", type: "password", required: true }],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { apiToken } = credentials
    if (!apiToken) return { ok: false, message: "API Token is required.", health: "unknown" }
    try {
      const response = await fetch(`${baseUrl(environment)}/c/api/pin-codes/json/?filter_codes=110001`, {
        headers: { Authorization: `Token ${apiToken}` },
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: "Delhivery rejected this API token.", health: "down" }
      }
      if (!response.ok) {
        return { ok: false, message: `Delhivery returned status ${response.status}.`, health: "down" }
      }
      return { ok: true, message: "Connected to Delhivery successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Delhivery.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Pincode serviceability check authenticated." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiToken = headers["x-delhivery-token"]
    if (!apiToken) return { ok: false, status: 400, message: "Missing X-Delhivery-Token header." }
    if (apiToken !== credentials.apiToken) return { ok: false, status: 401, message: "Token mismatch." }
    void rawBody
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
