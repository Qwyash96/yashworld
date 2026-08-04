import { NextResponse, type NextRequest } from "next/server"
import { listIntegrationLogs } from "@/lib/integrations/logs"
import { requireIntegrationAccess } from "@/lib/integrations/require-integration-access"
import { getAdapter } from "@/lib/integrations/registry"
import { listRecentWebhookEvents } from "@/lib/integrations/webhook-events"

export async function GET(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const auth = await requireIntegrationAccess(request, adapter)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const level = searchParams.get("level")
  const cursor = searchParams.get("cursor")

  const [logs, webhookEvents] = await Promise.all([
    listIntegrationLogs(providerId, { level: level === "info" || level === "error" ? level : undefined, cursor }),
    listRecentWebhookEvents(providerId),
  ])

  return NextResponse.json({ ...logs, webhookEvents })
}
