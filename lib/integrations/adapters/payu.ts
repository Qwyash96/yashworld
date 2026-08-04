import "server-only"
import { randomUUID } from "crypto"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// India-specific gateway. PayU has no zero-argument "ping" endpoint, so
// verification piggybacks on the documented Verify Payment API
// (https://docs.payu.in/reference/verify_payment_api) with a random,
// guaranteed-nonexistent transaction ID — a valid key+salt pair returns a
// "transaction not found"-style response, while an invalid key is rejected
// outright. Confirm this distinction still holds against PayU's current
// docs before enabling in production.
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://info.payu.in/merchant/postservice?form=2" : "https://test.payu.in/merchant/postservice?form=2"
}

export const payuAdapter: IntegrationAdapter = {
  id: "payu",
  name: "PayU",
  category: "payment",
  description: "India payment gateway — UPI, cards, net banking.",
  credentialFields: [
    { key: "merchantKey", label: "Merchant Key", type: "text", required: true },
    { key: "salt", label: "Salt", type: "password", required: true },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { createHash } = await import("crypto")
    const { merchantKey, salt } = credentials
    if (!merchantKey || !salt) return { ok: false, message: "Merchant Key and Salt are required.", health: "unknown" }

    const command = "verify_payment"
    const var1 = `probe-${randomUUID()}`
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${var1}|${salt}`).digest("hex")

    try {
      const response = await fetch(baseUrl(environment), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: merchantKey, command, var1, hash }).toString(),
      })
      const body = await response.json().catch(() => ({}))
      // status 0 with an "Invalid key" style message means the key itself
      // was rejected; anything else (including "transaction not found" for
      // our deliberately-fake var1) means the key/salt pair authenticated.
      const msg = String(body?.msg ?? "").toLowerCase()
      if (!response.ok || msg.includes("invalid key") || msg.includes("invalid hash")) {
        return { ok: false, message: body?.msg ?? "PayU rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to PayU successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach PayU.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "PayU Verify Payment API authenticated successfully." : result.message }
  },
}
