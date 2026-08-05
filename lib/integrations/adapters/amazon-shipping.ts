import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Amazon Shipping API v2 (Selling Partner API family). Auth is Login With
// Amazon (LWA): Client ID + Client Secret (from your SP-API app
// registration) exchanged with a Refresh Token (generated once when the
// seller authorizes the app in Seller Central) for a short-lived access
// token — see lib/amazon-shipping-client.ts for the real token-refresh
// call this verifies against. Region picks the SP-API base endpoint
// (NA/EU/FE); most India sellers are on "na" per Amazon's current
// regional mapping — confirm against
// https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints before
// enabling in production.
export const amazonShippingAdapter: IntegrationAdapter = {
  id: "amazon-shipping",
  name: "Amazon Shipping",
  category: "shipping",
  description: "Amazon's own carrier network — AWB generation, labels, tracking via the Selling Partner API.",
  credentialFields: [
    { key: "clientId", label: "LWA Client ID", type: "text", required: true },
    { key: "clientSecret", label: "LWA Client Secret", type: "password", required: true },
    { key: "refreshToken", label: "LWA Refresh Token", type: "password", required: true },
    { key: "region", label: "SP-API Region (na / eu / fe)", type: "text", required: true, placeholder: "na" },
    { key: "webhookSharedSecret", label: "Webhook Shared Secret", type: "password", required: false },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
    {
      key: "pickupLocationName",
      label: "Ship-From Address Nickname",
      type: "text",
      default: "",
      helpText: "The registered ship-from location this app should use when creating a shipment. Required for Auto AWB Generation.",
    },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { clientId, clientSecret, refreshToken } = credentials
    if (!clientId || !clientSecret || !refreshToken) {
      return { ok: false, message: "Client ID, Client Secret and Refresh Token are all required.", health: "unknown" }
    }
    try {
      const response = await fetch("https://api.amazon.com/auth/o2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.access_token) {
        return { ok: false, message: body?.error_description ?? body?.error ?? "Amazon rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Amazon Shipping successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Amazon.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "LWA token refresh succeeded." : result.message }
  },

  // SP-API delivers shipment notifications through EventBridge/SQS, not a
  // plain signed HTTP POST like most of this app's other webhook adapters —
  // this handles the two realistic shapes for an HTTPS notification
  // destination: an SNS-style subscription confirmation handshake, and a
  // notification authenticated by a shared secret header you configure on
  // your own relay/API-destination in front of the real SP-API
  // notification pipeline. Adjust to match how notifications are actually
  // wired once that's set up — this is a starting point, not a verified
  // integration.
  async handleWebhook(rawBody, headers, credentials) {
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return { ok: false, status: 400, message: "Invalid JSON payload." }
    }

    if (payload.Type === "SubscriptionConfirmation" && typeof payload.SubscribeURL === "string") {
      try {
        await fetch(payload.SubscribeURL)
      } catch (error) {
        return { ok: false, status: 502, message: error instanceof Error ? error.message : "Failed to confirm SNS subscription." }
      }
      return { ok: true, status: 200, message: "SNS subscription confirmed." }
    }

    const sharedSecret = headers["x-webhook-secret"]
    if (!credentials.webhookSharedSecret) return { ok: false, status: 503, message: "Webhook shared secret isn't configured." }
    if (sharedSecret !== credentials.webhookSharedSecret) return { ok: false, status: 401, message: "Webhook secret mismatch." }
    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
