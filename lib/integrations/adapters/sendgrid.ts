import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

export const sendgridAdapter: IntegrationAdapter = {
  id: "sendgrid",
  name: "SendGrid",
  category: "email",
  description: "Transactional email — order confirmations, receipts, notifications.",
  credentialFields: [
    { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "SG...." },
    { key: "fromAddress", label: "From Address", type: "text", required: false, placeholder: "orders@yourdomain.com" },
    { key: "webhookSigningKey", label: "Event Webhook Verification Key", type: "password", required: false },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { apiKey } = credentials
    if (!apiKey) return { ok: false, message: "API Key is required.", health: "unknown" }
    try {
      const response = await fetch("https://api.sendgrid.com/v3/user/account", {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        return { ok: false, message: body?.errors?.[0]?.message ?? "SendGrid rejected this API key.", health: "down" }
      }
      return { ok: true, message: "Connected to SendGrid successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach SendGrid.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "GET /v3/user/account authenticated successfully." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    // SendGrid Event Webhook signs with ECDSA (X-Twilio-Email-Event-Webhook-
    // Signature, verification key from the SendGrid dashboard) — not an HMAC
    // shared-secret, so it needs its own "signing key" credential rather
    // than reusing apiKey.
    const { createVerify } = await import("crypto")
    const signature = headers["x-twilio-email-event-webhook-signature"]
    const timestamp = headers["x-twilio-email-event-webhook-timestamp"]
    if (!signature || !timestamp) return { ok: false, status: 400, message: "Missing SendGrid webhook signature headers." }
    if (!credentials.webhookSigningKey) return { ok: false, status: 503, message: "Webhook signing key isn't configured." }

    try {
      const verifier = createVerify("SHA256")
      verifier.update(timestamp + rawBody)
      verifier.end()
      const publicKey = `-----BEGIN PUBLIC KEY-----\n${credentials.webhookSigningKey}\n-----END PUBLIC KEY-----`
      const valid = verifier.verify(publicKey, Buffer.from(signature, "base64"))
      if (!valid) return { ok: false, status: 400, message: "Invalid webhook signature." }
      return { ok: true, status: 200, message: "Webhook signature verified." }
    } catch (error) {
      return { ok: false, status: 400, message: error instanceof Error ? error.message : "Webhook signature verification failed." }
    }
  },
}
