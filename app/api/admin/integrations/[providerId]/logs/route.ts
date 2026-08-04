import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { listIntegrationLogs } from "@/lib/integrations/logs"
import { listRecentWebhookEvents } from "@/lib/integrations/webhook-events"

export async function GET(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { providerId } = await params
  const { searchParams } = new URL(request.url)
  const level = searchParams.get("level")
  const cursor = searchParams.get("cursor")

  const [logs, webhookEvents] = await Promise.all([
    listIntegrationLogs(providerId, { level: level === "info" || level === "error" ? level : undefined, cursor }),
    listRecentWebhookEvents(providerId),
  ])

  return NextResponse.json({ ...logs, webhookEvents })
}
