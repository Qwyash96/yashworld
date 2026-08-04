import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { writeAuditLog } from "@/lib/audit-log"
import {
  getIntegrationConfig,
  maskIntegrationConfig,
  saveIntegrationConfig,
  setDefaultPaymentGateway,
  type SaveIntegrationPatch,
} from "@/lib/integrations/config-store"
import { getAdapter } from "@/lib/integrations/registry"

export async function GET(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const config = await getIntegrationConfig(providerId)
  return NextResponse.json({
    config: maskIntegrationConfig(config),
    adapter: {
      id: adapter.id,
      name: adapter.name,
      category: adapter.category,
      description: adapter.description,
      credentialFields: adapter.credentialFields,
      settingFields: adapter.settingFields,
      supportsWebhook: adapter.supportsWebhook,
      supportsTest: adapter.supportsTest,
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const body = (await request.json()) as SaveIntegrationPatch
  if (body.environment && !["live", "sandbox"].includes(body.environment)) {
    return NextResponse.json({ error: "Invalid environment." }, { status: 400 })
  }
  if (body.priority !== undefined && (typeof body.priority !== "number" || body.priority < 0)) {
    return NextResponse.json({ error: "Priority must be a non-negative number." }, { status: 400 })
  }

  await saveIntegrationConfig(providerId, body, auth.uid)
  if (adapter.category === "payment" && body.isDefault) {
    await setDefaultPaymentGateway(providerId)
  }
  const saved = await getIntegrationConfig(providerId)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "integrations.save",
    targetType: "integration",
    targetId: providerId,
    after: { fieldsChanged: Object.keys(body) },
  })

  return NextResponse.json({ config: maskIntegrationConfig(saved) })
}
