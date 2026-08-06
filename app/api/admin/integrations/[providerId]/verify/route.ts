import { NextResponse, type NextRequest } from "next/server"
import { getDecryptedCredentials, getIntegrationConfig, markVerified, saveIntegrationConfig } from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { requireIntegrationAccess } from "@/lib/integrations/require-integration-access"
import { getAdapter } from "@/lib/integrations/registry"

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const auth = await requireIntegrationAccess(request, adapter)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [config, credentials] = [await getIntegrationConfig(providerId), await getDecryptedCredentials(providerId)]
  const missingFields = adapter.credentialFields.filter((field) => field.required && !credentials[field.key])
  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `Missing required field(s): ${missingFields.map((f) => f.label).join(", ")}` },
      { status: 400 },
    )
  }

  let result
  try {
    result = await adapter.verifyConnection(credentials, config.environment)
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Verification failed.", health: "down" as const }
  }

  await markVerified(providerId, result.ok, result.health)
  await writeIntegrationLog({
    providerId,
    category: adapter.category,
    level: result.ok ? "info" : "error",
    type: "verify",
    message: result.message,
  })

  // A successful Verify Connection proves these credentials genuinely work
  // right now — auto-activate instead of requiring a separate Enable click.
  // Applies to every gateway equally; IntegrationConfig.enabled is the one
  // "is this gateway usable" flag the payment router reads.
  if (result.ok) {
    await saveIntegrationConfig(providerId, { enabled: true }, auth.uid)
  }

  return NextResponse.json(result)
}
