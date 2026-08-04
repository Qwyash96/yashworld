import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { listIntegrationConfigs, maskIntegrationConfig } from "@/lib/integrations/config-store"
import { listAdapters } from "@/lib/integrations/registry"

/** Lists every registered provider (masked config + adapter metadata), for the /admin/integrations grid. */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [configs, adapters] = [await listIntegrationConfigs(), listAdapters()]
  const providers = configs.map((config) => {
    const adapter = adapters.find((a) => a.id === config.providerId)!
    return {
      config: maskIntegrationConfig(config),
      adapter: {
        id: adapter.id,
        name: adapter.name,
        category: adapter.category,
        description: adapter.description,
        supportsWebhook: adapter.supportsWebhook,
        supportsTest: adapter.supportsTest,
      },
    }
  })

  return NextResponse.json({ providers })
}
