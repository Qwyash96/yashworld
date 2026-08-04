import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

/** Sends to GA4's *debug* Measurement Protocol endpoint — validates the
 * event without ever recording real data, safe to call from Verify/Test. */
async function sendDebugEvent(measurementId: string, apiSecret: string) {
  const response = await fetch(
    `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      body: JSON.stringify({
        client_id: "integration-check.0000000000",
        events: [{ name: "integration_check" }],
      }),
    },
  )
  return response.json().catch(() => ({}))
}

export const googleAnalyticsAdapter: IntegrationAdapter = {
  id: "google_analytics",
  name: "Google Analytics 4",
  category: "analytics",
  description: "Site-wide traffic and conversion analytics.",
  credentialFields: [
    { key: "measurementId", label: "Measurement ID", type: "text", required: true, placeholder: "G-XXXXXXXXXX" },
    {
      key: "apiSecret",
      label: "API Secret (optional, enables server-side event verification)",
      type: "password",
      required: false,
    },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { measurementId, apiSecret } = credentials
    if (!measurementId) return { ok: false, message: "Measurement ID is required.", health: "unknown" }
    if (!MEASUREMENT_ID_PATTERN.test(measurementId)) {
      return { ok: false, message: "Measurement ID doesn't look valid (expected G-XXXXXXXXXX).", health: "down" }
    }
    if (!apiSecret) {
      // No server-side way to validate a bare Measurement ID without a
      // Measurement Protocol API Secret — format-valid is the best this
      // framework can confirm; the script tag itself confirms the rest
      // client-side once enabled.
      return { ok: true, message: "Measurement ID format is valid. Add an API Secret to enable server-side verification.", health: "healthy" }
    }
    try {
      const body = await sendDebugEvent(measurementId, apiSecret)
      const messages = body?.validationMessages ?? []
      if (messages.length > 0) {
        return { ok: false, message: messages[0]?.description ?? "GA4 rejected this event.", health: "down" }
      }
      return { ok: true, message: "GA4 Measurement Protocol debug event validated successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Google Analytics.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.message }
  },
}
