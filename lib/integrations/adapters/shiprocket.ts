import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Confirmed: Shiprocket authenticates via email+password against
// https://apiv2.shiprocket.in/v1/external/auth/login, returning a bearer
// token valid for 240 hours. No order in this app auto-generates an AWB
// yet — Auto AWB/Tracking/Pickup below are admin-manageable settings only.
export const shiprocketAdapter: IntegrationAdapter = {
  id: "shiprocket",
  name: "Shiprocket",
  category: "shipping",
  description: "Multi-carrier shipping aggregator — AWB generation, tracking, pickups.",
  credentialFields: [
    { key: "email", label: "API User Email", type: "text", required: true },
    { key: "password", label: "API User Password", type: "password", required: true },
    { key: "webhookApiKey", label: "Webhook API Key (from Shiprocket panel)", type: "password", required: false },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { email, password } = credentials
    if (!email || !password) return { ok: false, message: "Email and Password are required.", health: "unknown" }
    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.token) {
        return { ok: false, message: body?.message ?? "Shiprocket rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Shiprocket successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Shiprocket.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Shiprocket auth/login succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiKeyHeader = headers["x-api-key"]
    if (!apiKeyHeader) return { ok: false, status: 400, message: "Missing X-Api-Key header." }
    // Shiprocket webhooks are authenticated by matching a static API key
    // configured in the Shiprocket panel against the incoming header, not a
    // per-request HMAC — stored here under the `password` credential field
    // isn't reused for this; a real setup needs its own configured value.
    if (apiKeyHeader !== credentials.webhookApiKey) {
      return { ok: false, status: 401, message: "Webhook API key mismatch." }
    }
    void rawBody
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
