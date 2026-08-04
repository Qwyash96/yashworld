import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific SMS provider. The balance.php endpoint (type=4 for SMS
// balance) is MSG91's long-standing, stable authenticated check — verify
// against https://msg91.com/help before enabling in production.
export const msg91Adapter: IntegrationAdapter = {
  id: "msg91",
  name: "MSG91",
  category: "sms",
  description: "India SMS/OTP delivery.",
  credentialFields: [
    { key: "authKey", label: "Auth Key", type: "password", required: true },
    { key: "senderId", label: "Sender ID", type: "text", required: false, placeholder: "YSHWRD" },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { authKey } = credentials
    if (!authKey) return { ok: false, message: "Auth Key is required.", health: "unknown" }
    try {
      const response = await fetch(
        `https://api.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=4`,
      )
      const text = (await response.text()).trim()
      const balance = Number(text)
      if (!response.ok || Number.isNaN(balance)) {
        return { ok: false, message: text || "MSG91 rejected this Auth Key.", health: "down" }
      }
      return { ok: true, message: `Connected to MSG91 successfully (balance: ${balance}).`, health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach MSG91.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Balance check authenticated successfully." : result.message }
  },
}
