import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

const PIXEL_ID_PATTERN = /^\d{10,}$/

export const metaPixelAdapter: IntegrationAdapter = {
  id: "meta_pixel",
  name: "Meta Pixel",
  category: "analytics",
  description: "Site-wide Meta (Facebook/Instagram) ads conversion tracking.",
  credentialFields: [
    { key: "pixelId", label: "Pixel ID", type: "text", required: true },
    {
      key: "accessToken",
      label: "Conversions API Access Token (optional, enables server-side verification)",
      type: "password",
      required: false,
    },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { pixelId, accessToken } = credentials
    if (!pixelId) return { ok: false, message: "Pixel ID is required.", health: "unknown" }
    if (!PIXEL_ID_PATTERN.test(pixelId)) {
      return { ok: false, message: "Pixel ID doesn't look valid (expected a numeric ID).", health: "down" }
    }
    if (!accessToken) {
      return { ok: true, message: "Pixel ID format is valid. Add a Conversions API token to enable server-side verification.", health: "healthy" }
    }
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}?fields=name&access_token=${encodeURIComponent(accessToken)}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        return { ok: false, message: body?.error?.message ?? "Meta rejected this Pixel ID/token pair.", health: "down" }
      }
      return { ok: true, message: `Connected to Meta Pixel "${body.name ?? pixelId}".`, health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Meta Graph API.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.message }
  },
}
