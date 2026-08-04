import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"
import type { IntegrationCategory } from "@/types/integrations"

/**
 * The single place a new provider gets registered — write the adapter under
 * lib/integrations/adapters/, import it here, and add it to ADAPTERS.
 * Nothing else in the framework (routes, admin UI, encryption, logging)
 * needs to change to support it.
 */
const ADAPTERS: IntegrationAdapter[] = []

export function listAdapters(): IntegrationAdapter[] {
  return ADAPTERS
}

export function getAdapter(providerId: string): IntegrationAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === providerId)
}

export function listAdaptersByCategory(category: IntegrationCategory): IntegrationAdapter[] {
  return ADAPTERS.filter((adapter) => adapter.category === category)
}
