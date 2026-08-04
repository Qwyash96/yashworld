import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Blue Dart's current API (via the DHL eCommerce India developer portal)
// authenticates with a JWT fetched from an Authenticator endpoint using an
// app ClientID/ClientSecret pair — confirmed structurally from
// https://developer.dhl.com/api-reference/blue-dart-waybill, but the exact
// Authenticator endpoint path isn't publicly documented (gated behind a
// partner account). Verify against your Blue Dart/DHL developer portal
// credentials before enabling in production.
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://apigateway.bluedart.com" : "https://apigateway-sandbox.bluedart.com"
}

export const bluedartAdapter: IntegrationAdapter = {
  id: "bluedart",
  name: "Blue Dart",
  category: "shipping",
  description: "Domestic and international express logistics — waybills, tracking, pickups.",
  credentialFields: [
    { key: "clientId", label: "Client ID", type: "text", required: true },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
  ],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { clientId, clientSecret } = credentials
    if (!clientId || !clientSecret) return { ok: false, message: "Client ID and Client Secret are required.", health: "unknown" }
    try {
      const response = await fetch(`${baseUrl(environment)}/in/transportation/token/v1/login`, {
        headers: { ClientID: clientId, clientSecret },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body?.JWTToken) {
        return { ok: false, message: body?.message ?? "Blue Dart rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Blue Dart successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Blue Dart.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Blue Dart JWT token fetch succeeded." : result.message }
  },
}
