import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Confirmed from GoKwik's public docs: appid/appsecret passed as request
// headers, sandbox base https://sandbox.gokwik.co, with a documented
// /v2/rto/predict endpoint (used here as a lightweight auth check — a real
// integration would call it with a real order payload). The production base
// URL and the exact shape of a zero-side-effect "ping" call are NOT
// confirmed — verify against https://www.gokwik.co/docs/web-integration
// before enabling in production. None of GoKwik's 6 modules below are wired
// into checkout/COD/tracking behavior yet — admin-manageable only, matching
// this pass's confirmed scope (see the Plug-and-Play Integration System
// plan's "explicitly out of scope" section).
function baseUrl(environment: "live" | "sandbox") {
  return environment === "live" ? "https://api.gokwik.co" : "https://sandbox.gokwik.co"
}

export const gokwikAdapter: IntegrationAdapter = {
  id: "gokwik",
  name: "GoKwik",
  category: "checkout",
  description: "Smart checkout, COD risk intelligence, cart recovery, and returns for D2C brands.",
  credentialFields: [
    { key: "appId", label: "App ID", type: "text", required: true },
    { key: "appSecret", label: "App Secret", type: "password", required: true },
    { key: "webhookSecret", label: "Webhook Secret", type: "password", required: false },
  ],
  settingFields: [
    { key: "enableSmartCheckout", label: "Enable Smart Checkout", type: "boolean", default: true },
    { key: "enableCodIntelligence", label: "Enable COD Intelligence (RTO risk scoring)", type: "boolean", default: true },
    { key: "enableCartRecovery", label: "Enable Cart Recovery", type: "boolean", default: true },
    { key: "enableOtpLogin", label: "Enable OTP Login", type: "boolean", default: true },
    { key: "enableReturns", label: "Enable Returns", type: "boolean", default: true },
    { key: "enableTracking", label: "Enable Tracking", type: "boolean", default: true },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials, environment) {
    const { appId, appSecret } = credentials
    if (!appId || !appSecret) return { ok: false, message: "App ID and App Secret are required.", health: "unknown" }
    try {
      const response = await fetch(`${baseUrl(environment)}/v2/rto/predict`, {
        method: "POST",
        headers: { appid: appId, appsecret: appSecret, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: "GoKwik rejected these credentials.", health: "down" }
      }
      // Any other status (including a 400 for the deliberately-empty probe
      // payload) means the appid/appsecret pair authenticated.
      return { ok: true, message: "Connected to GoKwik successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach GoKwik.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "GoKwik API reachable and authenticated." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const { createHmac, timingSafeEqual } = await import("crypto")
    const signature = headers["x-gokwik-signature"]
    if (!signature) return { ok: false, status: 400, message: "Missing webhook signature header." }
    if (!credentials.webhookSecret) return { ok: false, status: 503, message: "Webhook secret isn't configured." }

    const computed = createHmac("sha256", credentials.webhookSecret).update(rawBody).digest("hex")
    const a = Buffer.from(computed)
    const b = Buffer.from(signature)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 400, message: "Invalid webhook signature." }
    }
    return { ok: true, status: 200, message: "Webhook signature verified." }
  },
}
