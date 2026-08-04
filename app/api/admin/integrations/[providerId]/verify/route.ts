import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getDecryptedCredentials, getIntegrationConfig, markVerified } from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { getAdapter } from "@/lib/integrations/registry"

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

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

  return NextResponse.json(result)
}
