import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"
import { verifyTwilioAccount, validateTwilioSignature } from "@/lib/integrations/adapters/twilio-shared"

export const twilioSmsAdapter: IntegrationAdapter = {
  id: "twilio_sms",
  name: "Twilio SMS",
  category: "sms",
  description: "SMS/OTP delivery via Twilio.",
  credentialFields: [
    { key: "accountSid", label: "Account SID", type: "text", required: true, placeholder: "AC..." },
    { key: "authToken", label: "Auth Token", type: "password", required: true },
    { key: "fromNumber", label: "From Number", type: "text", required: true, placeholder: "+15551234567" },
  ],
  settingFields: [],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    return verifyTwilioAccount(credentials)
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Twilio account lookup succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const signature = headers["x-twilio-signature"]
    if (!signature) return { ok: false, status: 400, message: "Missing X-Twilio-Signature header." }
    if (!credentials.authToken) return { ok: false, status: 503, message: "Auth Token isn't configured." }

    const url = `https://${headers.host}/api/integrations/twilio_sms/webhook`
    const params = new URLSearchParams(rawBody)
    if (!(await validateTwilioSignature(credentials.authToken, url, params, signature))) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }
    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
