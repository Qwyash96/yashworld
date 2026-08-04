import "server-only"
import type { IntegrationAdapter } from "@/lib/integrations/types"
import type { IntegrationCategory } from "@/types/integrations"
import { razorpayAdapter } from "@/lib/integrations/adapters/razorpay"
import { cashfreeAdapter } from "@/lib/integrations/adapters/cashfree"
import { phonepeAdapter } from "@/lib/integrations/adapters/phonepe"
import { payuAdapter } from "@/lib/integrations/adapters/payu"
import { stripeAdapter } from "@/lib/integrations/adapters/stripe"
import { paypalAdapter } from "@/lib/integrations/adapters/paypal"

/**
 * The single place a new provider gets registered — write the adapter under
 * lib/integrations/adapters/, import it here, and add it to ADAPTERS.
 * Nothing else in the framework (routes, admin UI, encryption, logging)
 * needs to change to support it.
 */
const ADAPTERS: IntegrationAdapter[] = [razorpayAdapter, cashfreeAdapter, phonepeAdapter, payuAdapter, stripeAdapter, paypalAdapter]

export function listAdapters(): IntegrationAdapter[] {
  return ADAPTERS
}

export function getAdapter(providerId: string): IntegrationAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === providerId)
}

export function listAdaptersByCategory(category: IntegrationCategory): IntegrationAdapter[] {
  return ADAPTERS.filter((adapter) => adapter.category === category)
}
