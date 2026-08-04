"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CreditCard, Truck, ShoppingCart, MessageCircle, Mail, MessageSquare, BarChart3, Plug } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchIntegrations, type ProviderSummary } from "@/lib/admin-integrations-client"
import { hasPermission, isAdminRole } from "@/lib/admin-roles"
import type { IntegrationCategory } from "@/types/integrations"
import { Badge } from "@/components/ui/badge"

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payment: "Payment Gateways",
  shipping: "Shipping",
  checkout: "Checkout",
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  analytics: "Analytics",
}

const CATEGORY_ICONS: Record<IntegrationCategory, typeof CreditCard> = {
  payment: CreditCard,
  shipping: Truck,
  checkout: ShoppingCart,
  whatsapp: MessageCircle,
  email: Mail,
  sms: MessageSquare,
  analytics: BarChart3,
}

const CATEGORY_ORDER: IntegrationCategory[] = ["payment", "shipping", "checkout", "whatsapp", "email", "sms", "analytics"]

const HEALTH_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  degraded: "secondary",
  down: "destructive",
  unknown: "outline",
}

export default function AdminIntegrationsPage() {
  const admin = useAdminAuth()
  const [providers, setProviders] = useState<ProviderSummary[] | null>(null)

  useEffect(() => {
    fetchIntegrations().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setProviders(result.providers)
    })
  }, [])

  // Route guard (AdminLayout) already restricts who can reach this page at
  // all; a "payments"-holder who isn't super_admin only ever gets here to
  // manage payment gateways (see components/admin/admin-sidebar.tsx's
  // Payments section), so their view of this shared list is filtered down
  // to just that category — they never see Shipping/WhatsApp/Email/SMS/
  // Analytics credentials.
  const canManagePaymentsOnly = admin.role !== "super_admin" && isAdminRole(admin.role) && hasPermission(admin.role, "payments")
  if (admin.role !== "super_admin" && !canManagePaymentsOnly) {
    return <div className="p-8 text-center text-sm text-[#444444]">You don't have access to Integrations.</div>
  }

  if (!providers) return null

  const visibleCategories = canManagePaymentsOnly ? (["payment"] as IntegrationCategory[]) : CATEGORY_ORDER
  const grouped = visibleCategories
    .map((category) => ({
      category,
      providers: providers.filter((p) => p.adapter.category === category),
    }))
    .filter((group) => group.providers.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Integrations</h1>
        <p className="mt-1 text-sm text-[#444444]">
          Connect third-party services by entering API credentials — no code changes required.
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Plug className="size-8 text-[#888888]" />
          <p className="text-sm text-[#444444]">No integration adapters are registered yet.</p>
        </div>
      ) : (
        grouped.map(({ category, providers: categoryProviders }) => {
          const Icon = CATEGORY_ICONS[category]
          return (
            <section key={category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
                <Icon className="size-4 text-green-700" />
                {CATEGORY_LABELS[category]}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryProviders.map(({ config, adapter }) => (
                  <Link
                    key={adapter.id}
                    href={`/admin/integrations/${adapter.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-green-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-black">{adapter.name}</p>
                        <p className="mt-0.5 text-xs text-[#444444]">{adapter.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.enabled ? "default" : "outline"}>{config.enabled ? "Enabled" : "Disabled"}</Badge>
                      <Badge variant={config.connected ? "default" : "outline"}>
                        {config.connected ? "Connected" : "Not Connected"}
                      </Badge>
                      <Badge variant={HEALTH_VARIANT[config.health]}>{config.health}</Badge>
                      {config.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
