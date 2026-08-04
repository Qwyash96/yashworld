import "server-only"
import type { NextRequest } from "next/server"
import { requireAnyAdmin } from "@/lib/admin-api-auth"
import { hasPermission } from "@/lib/admin-roles"
import type { IntegrationAdapter } from "@/lib/integrations/types"

/**
 * super_admin manages every integration; a "payments"-permission holder
 * (finance, admin) manages payment-category adapters specifically —
 * matching the sidebar's Payments section (components/admin/admin-sidebar.tsx)
 * and the route guard's per-path overrides for the 6 payment gateway pages.
 * Every other category (shipping/checkout/whatsapp/email/sms/analytics)
 * stays super_admin-only.
 */
export async function requireIntegrationAccess(request: NextRequest, adapter: Pick<IntegrationAdapter, "category">) {
  const auth = await requireAnyAdmin(request)
  if (!auth.ok) return auth
  if (auth.role === "super_admin") return auth
  if (adapter.category === "payment" && hasPermission(auth.role, "payments")) return auth
  return { ok: false as const, status: 403, error: "You don't have permission to manage this integration." }
}
