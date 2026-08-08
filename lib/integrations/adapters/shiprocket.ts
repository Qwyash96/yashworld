import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"

// Confirmed: Shiprocket authenticates via email+password against
// https://apiv2.shiprocket.in/v1/external/auth/login, returning a bearer
// token valid for 240 hours. When "Auto AWB Generation" is on, a seller's
// Schedule Pickup action (app/api/seller/orders/[id]/status) calls
// lib/shiprocket-client.ts to create the shipment and assign a real AWB
// synchronously — no manual courier/tracking entry needed. "Auto Tracking
// Sync" powers the seller's "Sync Tracking" button (a live pull, not a
// passive webhook — see app/api/seller/orders/[id]/track), which advances
// the order through the same validated status pipeline as a manual update.
export const shiprocketAdapter: IntegrationAdapter = {
  id: "shiprocket",
  name: "Shiprocket",
  category: "shipping",
  description: "Multi-carrier shipping aggregator — AWB generation, tracking, pickups.",
  credentialFields: [
    { key: "email", label: "API User Email", type: "text", required: true },
    { key: "password", label: "API User Password", type: "password", required: true },
    { key: "webhookApiKey", label: "Webhook API Key (from Shiprocket panel)", type: "password", required: false },
  ],
  settingFields: [
    { key: "autoAwb", label: "Auto AWB Generation", type: "boolean", default: false },
    { key: "autoTracking", label: "Auto Tracking Sync", type: "boolean", default: false },
    { key: "autoPickup", label: "Auto Pickup Scheduling", type: "boolean", default: false },
    {
      key: "pickupLocationName",
      label: "Pickup Location Nickname",
      type: "text",
      default: "",
      helpText: "The pickup location nickname from your Shiprocket panel (Settings → Pickup Addresses). Required for Auto AWB Generation.",
    },
  ],
  supportsWebhook: true,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { email, password } = credentials
    if (!email || !password) return { ok: false, message: "Email and Password are required.", health: "unknown" }
    try {
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.token) {
        return { ok: false, message: body?.message ?? "Shiprocket rejected these credentials.", health: "down" }
      }
      return { ok: true, message: "Connected to Shiprocket successfully.", health: "healthy" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Shiprocket.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.ok ? "Shiprocket auth/login succeeded." : result.message }
  },

  async handleWebhook(rawBody, headers, credentials) {
    const apiKeyHeader = headers["x-api-key"]
    if (!apiKeyHeader) return { ok: false, status: 400, message: "Missing X-Api-Key header." }
    // Shiprocket webhooks are authenticated by matching a static API key
    // configured in the Shiprocket panel against the incoming header, not a
    // per-request HMAC — stored here under the `password` credential field
    // isn't reused for this; a real setup needs its own configured value.
    if (apiKeyHeader !== credentials.webhookApiKey) {
      return { ok: false, status: 401, message: "Webhook API key mismatch." }
    }

    // Best-effort payload parse — Shiprocket's real webhook shape includes
    // `awb`, `current_status`, and (per their docs) echoes back whatever
    // "order_id" this app submitted at shipment-creation time, typically as
    // `channel_order_id`. VERIFY these exact field names against a real
    // payload once a live Shiprocket webhook is actually configured and
    // firing — this is best-effort against published shape, not yet
    // confirmed against a real delivery like the rest of this adapter's
    // create/assign/track/cancel calls are.
    try {
      const event = JSON.parse(rawBody) as {
        awb?: string
        current_status?: string
        channel_order_id?: string
        order_id?: string
      }
      const reference = event.channel_order_id ?? event.order_id
      const rawStatus = event.current_status
      if (reference && rawStatus) {
        const [{ decomposeShipmentReference, applyTrackingUpdate }, { mapShiprocketStatusToOrderStatus }] = await Promise.all([
          import("@/lib/order-tracking-sync"),
          import("@/lib/shiprocket-client"),
        ])
        const decomposed = decomposeShipmentReference(reference)
        const mappedStatus = mapShiprocketStatusToOrderStatus(rawStatus)
        if (decomposed) {
          await applyTrackingUpdate(decomposed.orderId, decomposed.sellerId, { rawStatus, mappedStatus }, "webhook")
        }
      }
    } catch (error) {
      // A malformed/unrecognized payload still gets a 200 (Shiprocket
      // authenticated fine — the signature check above already passed) so
      // it isn't retried forever, but the failure is logged for admin
      // investigation via Admin -> Integrations -> Shiprocket's log feed.
      console.error("[shiprocket-webhook] failed to parse/apply payload:", error)
    }

    return { ok: true, status: 200, message: "Webhook authenticated." }
  },
}
