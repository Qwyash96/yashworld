import { NextResponse, type NextRequest } from "next/server"
import { getDecryptedCredentials } from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { razorpayAdapter } from "@/lib/integrations/adapters/razorpay"
import { writeWebhookEvent } from "@/lib/integrations/webhook-events"

/**
 * Legacy webhook URL, kept working so an already-configured Razorpay
 * Dashboard webhook doesn't silently break — delegates to the same
 * razorpayAdapter.handleWebhook() the generic
 * /api/integrations/razorpay/webhook route uses. New setups should point
 * the Razorpay Dashboard at the generic URL instead (shown in
 * /admin/integrations/razorpay); this reconciliation-only receiver (not the
 * primary order-creation path — app/api/payments/razorpay/verify already
 * creates the order synchronously) is not the canonical URL to configure.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const credentials = await getDecryptedCredentials("razorpay")
  const result = await razorpayAdapter.handleWebhook!(rawBody, headers, credentials)

  await writeWebhookEvent({ providerId: "razorpay", verified: result.ok, statusCode: result.status })
  await writeIntegrationLog({
    providerId: "razorpay",
    category: "payment",
    level: result.ok ? "info" : "error",
    type: "webhook",
    message: result.message,
  })

  return NextResponse.json({ message: result.message }, { status: result.status })
}
