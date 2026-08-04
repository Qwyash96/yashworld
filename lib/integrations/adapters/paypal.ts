import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"
}

async function fetchAccessToken(clientId: string, clientSecret: string, environment: "live" | "sandbox") {
  const response = await fetch(`${baseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

export const paypalAdapter: IntegrationAdapter = {
  id: "paypal",
  name: "PayPal",
  category: "payment",
  description: "Global checkout via PayPal — cards and PayPal wallet.",
  credentialFields: [
    { key: "clientId", label: "Client ID", type: "text", required: true },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true },
    {
      key: "webhookId",
      label: "Webhook ID (optional, for webhook signature verification)",
      type: "text",
      required: false,
    },
  ],
  settingFields: [],
  // PayPal webhook verification requires a live call to PayPal's own
  // verify-webhook-signature API (not a local HMAC check), so it needs
  // network access at verify time — implemented below.
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { clientId, clientSecret } = credentials
    if (!clientId || !clientSecret) return { ok: false, message: "Client ID and Client Secret are required.", health: "unknown" }
    try {
      const { response, body } = await fetchAccessToken(clientId, clientSecret, environment)
      if (!response.ok) {
        return { ok: false, message: body?.error_description ?? "PayPal rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to PayPal successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach PayPal.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "PayPal OAuth2 token fetch succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.webhookId) {
      return { ok: false, status: 503, message: "Client ID, Client Secret and Webhook ID must all be configured." }
    }
    const environment: "live" | "sandbox" = headers["x-pp-environment"] === "live" ? "live" : "sandbox"
    try {
      const { response: tokenResponse, body: tokenBody } = await fetchAccessToken(
        credentials.clientId,
        credentials.clientSecret,
        environment,
      )
      if (!tokenResponse.ok) return { ok: false, status: 401, message: "PayPal OAuth token fetch failed." }

      const verifyResponse = await fetch(`${baseUrl(environment)}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenBody.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          transmission_id: headers["paypal-transmission-id"],
          transmission_time: headers["paypal-transmission-time"],
          cert_url: headers["paypal-cert-url"],
          auth_algo: headers["paypal-auth-algo"],
          transmission_sig: headers["paypal-transmission-sig"],
          webhook_id: credentials.webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      })
      const verifyBody = await verifyResponse.json().catch(() => ({}))
      if (verifyBody.verification_status !== "SUCCESS") {
        return { ok: false, status: 400, message: "PayPal webhook signature verification failed." }
      }
      return { ok: true, status: 200, message: "Webhook signature verified." }
    } catch (error) {
      return { ok: false, status: 500, message: error instanceof Error ? error.message : "Webhook verification failed." }
    }
  },
}
