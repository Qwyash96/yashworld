import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Meta WhatsApp Cloud API — well-documented, stable Graph API. Note: Meta
// also requires a GET request (hub.challenge echo) to verify a webhook URL
// before it will start sending POSTs to it; the generic webhook route in
// this framework only handles POST, so completing Meta's webhook
// registration needs that GET handled separately when this channel is
// actually wired up (not required for credential verification below).
export const metaWhatsappAdapter: IntegrationAdapter = {
  id: "meta_whatsapp",
  name: "Meta WhatsApp Cloud API",
  category: "whatsapp",
  description: "Official WhatsApp Business Platform — order updates, support, cart recovery.",
  credentialFields: [
    { key: "phoneNumberId", label: "Phone Number ID", type: "text", required: true },
    { key: "accessToken", label: "Access Token", type: "password", required: true },
    { key: "appSecret", label: "App Secret (for webhook signature)", type: "password", required: false },
    { key: "verifyToken", label: "Webhook Verify Token", type: "password", required: false },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { phoneNumberId, accessToken } = credentials
    if (!phoneNumberId || !accessToken) {
      return { ok: false, message: "Phone Number ID and Access Token are required.", health: "unknown" }
    }
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}?fields=verified_name,display_phone_number`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        return { ok: false, message: body?.error?.message ?? "Meta rejected these credentials.", health: "down" }
      }
      return { ok: true, message: `Connected to WhatsApp number ${body.display_phone_number ?? phoneNumberId}.`, health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Meta Graph API.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Graph API phone-number lookup succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const { createHmac, timingSafeEqual } = await import("crypto")
    const signatureHeader = headers["x-hub-signature-256"]
    if (!signatureHeader) return { ok: false, status: 400, message: "Missing X-Hub-Signature-256 header." }
    if (!credentials.appSecret) return { ok: false, status: 503, message: "App Secret isn't configured." }

    const computed = "sha256=" + createHmac("sha256", credentials.appSecret).update(rawBody).digest("hex")
    const a = Buffer.from(computed)
    const b = Buffer.from(signatureHeader)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }
    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
