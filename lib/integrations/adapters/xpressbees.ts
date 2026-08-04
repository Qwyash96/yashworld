import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific carrier. Login shape (email+password -> bearer token)
// confirmed structurally from Xpressbees' published integration docs;
// verify the exact endpoint/response field names against
// https://apitracker.io/a/xpressbees before enabling in production.
export const xpressbeesAdapter: IntegrationAdapter = {
  id: "xpressbees",
  name: "Xpressbees",
  category: "shipping",
  description: "Pan-India courier — AWB generation, tracking, reverse pickup.",
  credentialFields: [
    { key: "email", label: "Account Email", type: "text", required: true },
    { key: "password", label: "Account Password", type: "password", required: true },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
  ],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { email, password } = credentials
    if (!email || !password) return { ok: false, message: "Email and Password are required.", health: "unknown" }
    try {
      const response = await fetch("https://shipment.xpressbees.com/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body?.status === false || !body?.data) {
        return { ok: false, message: body?.message ?? "Xpressbees rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Xpressbees successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Xpressbees.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Xpressbees login succeeded." : result.message }
  },
}
