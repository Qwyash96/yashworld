import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Ekart Logistics has no published self-serve API reference — access is
// provisioned per-merchant, so the base URL is a credential field here
// rather than hardcoded (unlike Shiprocket/Delhivery, whose hosts are
// public and stable). See lib/ekart-client.ts's doc comment: every
// resource path is a placeholder in the aggregator-standard shape this
// app's other courier clients already use, ready to adjust the moment
// your Ekart integration contact confirms the real paths/payload names.
// verifyConnection below assumes a lightweight authenticated GET
// (`/v1/ping`) exists — swap it for whatever real health-check endpoint
// Ekart's docs specify once you have them.
export const ekartAdapter: IntegrationAdapter = {
  id: "ekart",
  name: "Ekart Logistics",
  category: "shipping",
  description: "Flipkart Group's logistics network — AWB generation, tracking, reverse pickup.",
  credentialFields: [
    { key: "apiKey", label: "API Key", type: "password", required: true },
    { key: "merchantId", label: "Merchant ID", type: "text", required: true },
    { key: "baseUrl", label: "API Base URL (from your Ekart integration contact)", type: "url", required: true, placeholder: "https://api.ekartlogistics.com" },
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
      helpText: "The registered pickup address nickname from your Ekart account. Required for Auto AWB Generation.",
    },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { apiKey, merchantId, baseUrl } = credentials
    if (!apiKey || !merchantId || !baseUrl) {
      return { ok: false, message: "API Key, Merchant ID and API Base URL are all required.", health: "unknown" }
    }
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/ping`, {
        headers: { Authorization: `Bearer ${apiKey}`, "X-Merchant-Id": merchantId },
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: "Ekart rejected this API key.", health: "down" }
      }
      if (!response.ok) {
        return { ok: false, message: `Ekart returned status ${response.status}.`, health: "down" }
      }
      return { ok: true, message: "Connected to Ekart Logistics successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Ekart.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Ekart health check authenticated." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiKeyHeader = headers["x-ekart-api-key"]
    if (!apiKeyHeader) return { ok: false, status: 400, message: "Missing X-Ekart-Api-Key header." }
    if (apiKeyHeader !== credentials.apiKey) return { ok: false, status: 401, message: "API key mismatch." }
    void rawBody
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
