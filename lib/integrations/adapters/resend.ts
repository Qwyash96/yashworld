import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

export const resendAdapter: IntegrationAdapter = {
  id: "resend",
  name: "Resend",
  category: "email",
  description: "Transactional email — order confirmations, receipts, notifications.",
  credentialFields: [
    { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "re_..." },
    { key: "fromAddress", label: "From Address", type: "text", required: false, placeholder: "orders@yourdomain.com" },
    { key: "webhookSecret", label: "Webhook Signing Secret", type: "password", required: false, placeholder: "whsec_..." },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { apiKey } = credentials
    if (!apiKey) return { ok: false, message: "API Key is required.", health: "unknown" }
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        return { ok: false, message: body?.message ?? "Resend rejected this API key.", health: "down" }
      }
      return { ok: true, message: "Connected to Resend successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Resend.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "GET /domains authenticated successfully." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    // Resend signs webhooks using the Svix format (svix-id/svix-timestamp/
    // svix-signature, base64 HMAC-SHA256 of "id.timestamp.body" with the
    // signing secret's base64 payload after its "whsec_" prefix).
    const { createHmac, timingSafeEqual } = await import("crypto")
    const svixId = headers["svix-id"]
    const svixTimestamp = headers["svix-timestamp"]
    const svixSignature = headers["svix-signature"]
    if (!svixId || !svixTimestamp || !svixSignature) {
      return { ok: false, status: 400, message: "Missing Svix webhook headers." }
    }
    if (!credentials.webhookSecret) return { ok: false, status: 503, message: "Webhook secret isn't configured." }

    const secret = Buffer.from(credentials.webhookSecret.replace(/^whsec_/, ""), "base64")
    const computed = createHmac("sha256", secret).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest("base64")
    const provided = svixSignature.split(" ").map((s) => s.split(",")[1]).find(Boolean) ?? ""
    const a = Buffer.from(computed)
    const b = Buffer.from(provided)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }
    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
