import { NextResponse, type NextRequest } from "next/server"
import { requireAnyAdmin } from "@/lib/admin-api-auth"
import { hasPermission } from "@/lib/admin-roles"
import { listIntegrationConfigs, maskIntegrationConfig } from "@/lib/integrations/config-store"
import { listAdapters } from "@/lib/integrations/registry"

/** Lists every registered provider (masked config + adapter metadata), for
 * the /admin/integrations grid. super_admin sees every provider; a
 * "payments"-permission holder (finance, admin) sees payment-category
 * providers only — matching app/admin/integrations/page.tsx's own
 * client-side filter, enforced here too so the API never leaks the rest. */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const isSuperAdmin = auth.role === "super_admin"
  const canManagePayments = isSuperAdmin || hasPermission(auth.role, "payments")
  if (!canManagePayments) return NextResponse.json({ error: "You don't have permission to view integrations." }, { status: 403 })

  const [configs, adapters] = [await listIntegrationConfigs(), listAdapters()]
  const visibleConfigs = isSuperAdmin ? configs : configs.filter((c) => c.category === "payment")

  const providers = visibleConfigs.map((config) => {
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
