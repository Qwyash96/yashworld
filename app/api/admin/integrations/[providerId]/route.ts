import { NextResponse, type NextRequest } from "next/server"
import { writeAuditLog } from "@/lib/audit-log"
import {
  buildCandidateCredentials,
  getIntegrationConfig,
  maskIntegrationConfig,
  markVerified,
  saveIntegrationConfig,
  setDefaultPaymentGateway,
  type SaveIntegrationPatch,
} from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { requireIntegrationAccess } from "@/lib/integrations/require-integration-access"
import { getAdapter } from "@/lib/integrations/registry"
import type { VerifyResult } from "@/lib/integrations/types"

export async function GET(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const auth = await requireIntegrationAccess(request, adapter)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

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
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const auth = await requireIntegrationAccess(request, adapter)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveIntegrationPatch
  if (body.environment && !["live", "sandbox"].includes(body.environment)) {
    return NextResponse.json({ error: "Invalid environment." }, { status: 400 })
  }
  if (body.priority !== undefined && (typeof body.priority !== "number" || body.priority < 0)) {
    return NextResponse.json({ error: "Priority must be a non-negative number." }, { status: 400 })
  }

  // Credentials are verified against the real provider BEFORE anything is
  // written — an invalid pair is rejected with the adapter's exact error
  // and the save is a no-op, matching how the old Razorpay-only settings
  // page worked ("Save tests the Key ID/Secret before storing them").
  let verifyResult: VerifyResult | null = null
  if (body.credentials) {
    const candidateCredentials = await buildCandidateCredentials(providerId, body.credentials)
    const candidateEnvironment = body.environment ?? (await getIntegrationConfig(providerId)).environment
    try {
      verifyResult = await adapter.verifyConnection(candidateCredentials, candidateEnvironment)
    } catch (error) {
      verifyResult = { ok: false, message: error instanceof Error ? error.message : "Verification failed.", health: "down" }
    }
    if (!verifyResult.ok) {
      await writeIntegrationLog({ providerId, category: adapter.category, level: "error", type: "verify", message: verifyResult.message })
      return NextResponse.json({ error: verifyResult.message }, { status: 400 })
    }
  }

  // Verification just proved these credentials genuinely work right now —
  // auto-activate instead of requiring a second manual Enable + Verify step.
  const patch: SaveIntegrationPatch = verifyResult?.ok ? { ...body, enabled: true } : body
  await saveIntegrationConfig(providerId, patch, auth.uid)

  if (verifyResult?.ok) {
    await markVerified(providerId, true, verifyResult.health)
    await writeIntegrationLog({ providerId, category: adapter.category, level: "info", type: "verify", message: verifyResult.message })
  }

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
    after: { fieldsChanged: Object.keys(body), autoVerified: verifyResult?.ok ?? false },
  })

  return NextResponse.json({ config: maskIntegrationConfig(saved), verified: verifyResult?.ok ?? null })
}
