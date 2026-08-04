import { NextResponse, type NextRequest } from "next/server"
import { getDecryptedCredentials } from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { getAdapter } from "@/lib/integrations/registry"
import { writeWebhookEvent } from "@/lib/integrations/webhook-events"

/**
 * Public, unauthenticated — the provider itself calls this. No admin auth
 * gate here; each adapter's handleWebhook() is responsible for verifying the
 * provider's own signature using its stored credentials before trusting the
 * payload.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter || !adapter.handleWebhook) {
    return NextResponse.json({ error: "Unknown provider or webhook not supported." }, { status: 404 })
  }

  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const credentials = await getDecryptedCredentials(providerId)

  let result
  try {
    result = await adapter.handleWebhook(rawBody, headers, credentials)
  } catch (error) {
    result = { ok: false, status: 500, message: error instanceof Error ? error.message : "Webhook handling failed." }
  }

  await writeWebhookEvent({ providerId, verified: result.ok, statusCode: result.status })
  await writeIntegrationLog({
    providerId,
    category: adapter.category,
    level: result.ok ? "info" : "error",
    type: "webhook",
    message: result.message,
  })

  return NextResponse.json({ message: result.message }, { status: result.status })
}
