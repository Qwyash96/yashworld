import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Shift Logistics — no publicly-documented API reference was available to
// build this against. Same treatment as lib/integrations/adapters/ekart.ts:
// a real adapter with a configurable base URL, ready to work the moment
// your Shift Logistics integration contact provides the real host and
// confirms lib/shift-logistics-client.ts's resource paths/payload field
// names. verifyConnection assumes a lightweight authenticated GET
// (`/v1/ping`) exists — swap it for whatever real health-check endpoint
// their docs specify once you have them.
export const shiftLogisticsAdapter: IntegrationAdapter = {
  id: "shift-logistics",
  name: "Shift Logistics",
  category: "shipping",
  description: "Courier partner — AWB generation, tracking, pickups.",
  credentialFields: [
    { key: "apiKey", label: "API Key", type: "password", required: true },
    { key: "apiSecret", label: "API Secret", type: "password", required: true },
    { key: "baseUrl", label: "API Base URL (from your Shift Logistics integration contact)", type: "url", required: true, placeholder: "https://api.shiftlogistics.example" },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
    {
      key: "pickupLocationName",
      label: "Pickup Location Nickname",
      type: "text",
      default: "",
      helpText: "The registered pickup address nickname from your Shift Logistics account. Required for Auto AWB Generation.",
    },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { apiKey, apiSecret, baseUrl } = credentials
    if (!apiKey || !apiSecret || !baseUrl) {
      return { ok: false, message: "API Key, API Secret and API Base URL are all required.", health: "unknown" }
    }
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/ping`, {
        headers: { "X-Api-Key": apiKey, "X-Api-Secret": apiSecret },
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: "Shift Logistics rejected these credentials.", health: "down" }
      }
      if (!response.ok) {
        return { ok: false, message: `Shift Logistics returned status ${response.status}.`, health: "down" }
      }
      return { ok: true, message: "Connected to Shift Logistics successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Shift Logistics.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Shift Logistics health check authenticated." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiKeyHeader = headers["x-shift-api-key"]
    if (!apiKeyHeader) return { ok: false, status: 400, message: "Missing X-Shift-Api-Key header." }
    if (apiKeyHeader !== credentials.apiKey) return { ok: false, status: 401, message: "API key mismatch." }
    void rawBody
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
