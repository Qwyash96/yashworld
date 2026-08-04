import { NextResponse, type NextRequest } from "next/server"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import { writeIntegrationLog } from "@/lib/integrations/logs"
import { requireIntegrationAccess } from "@/lib/integrations/require-integration-access"
import { getAdapter } from "@/lib/integrations/registry"

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params
  const adapter = getAdapter(providerId)
  if (!adapter) return NextResponse.json({ error: "Unknown integration provider." }, { status: 404 })

  const auth = await requireIntegrationAccess(request, adapter)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!adapter.supportsTest || !adapter.testAction) {
    return NextResponse.json({ error: `${adapter.name} doesn't support a test action.` }, { status: 400 })
  }

  const config = await getIntegrationConfig(providerId)
  const credentials = await getDecryptedCredentials(providerId)

  let result
  try {
    result = await adapter.testAction(credentials, config.environment, config.settings)
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Test call failed." }
  }

  await writeIntegrationLog({
    providerId,
    category: adapter.category,
    level: result.ok ? "info" : "error",
    type: "test",
    message: result.message,
  })

  return NextResponse.json(result)
}
