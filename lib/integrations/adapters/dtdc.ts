import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Lowest-confidence shipping adapter in this framework — DTDC's official
// API docs are not publicly published and must be requested directly from
// DTDC after signing up as a business customer. The username/password ->
// token shape below is structural, based on their staging authenticate
// endpoint; confirm real endpoints/hosts with DTDC before enabling in
// production.
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live"
    ? "https://ctbsplusapi.dtdc.com/dtdc-api/api/dtdc/authenticate"
    : "https://ctbsplusapi.dtdc.com/dtdc-staging-api/api/dtdc/authenticate"
}

export const dtdcAdapter: IntegrationAdapter = {
  id: "dtdc",
  name: "DTDC",
  category: "shipping",
  description: "Pan-India courier network — AWB, tracking.",
  credentialFields: [
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { username, password } = credentials
    if (!username || !password) return { ok: false, message: "Username and Password are required.", health: "unknown" }
    try {
      const response = await fetch(baseUrl(environment), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body?.token) {
        return { ok: false, message: body?.message ?? "DTDC rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to DTDC successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach DTDC.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "DTDC authenticate call succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiKey = headers["x-dtdc-key"]
    if (!apiKey) return { ok: false, status: 400, message: "Missing X-DTDC-Key header." }
    if (apiKey !== credentials.password) return { ok: false, status: 401, message: "Key mismatch." }
    void rawBody
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
