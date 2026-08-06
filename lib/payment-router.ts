import "server-only"
import { getDecryptedCredentials, getIntegrationConfig, listIntegrationConfigs, markPaymentAttempt } from "@/lib/integrations/config-store"
import { getAdapter } from "@/lib/integrations/registry"
import type {
  PaymentOrderInput,
  PaymentOrderResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
  RefundInput,
  RefundResult,
  PaymentStatusSyncInput,
  PaymentStatusSyncResult,
} from "@/lib/integrations/types"
import type { IntegrationConfig } from "@/types/integrations"

/**
 * The checkout-time payment gateway router — the one place that decides
 * which of the 6 registered gateways actually processes a given payment.
 * Modeled directly on lib/shipping-service.ts's tryAutoGenerateAwb
 * (priority-sort over enabled candidates), extended with real
 * failure-triggered fallback: if the highest-priority gateway's own
 * createPaymentOrder call throws, the next one is tried automatically,
 * rather than just picking one candidate and living with whatever happens.
 *
 * Nothing here is ever gateway-name-specific — every buyer-facing route
 * calls only these functions, never an adapter by id directly, so "which
 * gateway is being used" never has to be a concept anywhere above this file.
 */
async function routableCandidates(): Promise<IntegrationConfig[]> {
  const configs = await listIntegrationConfigs()
  return configs
    .filter((c) => c.category === "payment" && c.enabled && c.connected)
    .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
}

/** Whether checkout currently has any online gateway to fall back to — drives PublicCheckoutConfig.checkout.anyGatewayAvailable. */
export async function hasRoutableGateway(): Promise<boolean> {
  return (await routableCandidates()).length > 0
}

export interface RoutedPaymentOrder extends PaymentOrderResult {
  /** Server-internal only — never rendered as text anywhere in the UI. The
   * client-side launcher (lib/payment-gateway-client.ts) switches on this
   * purely to know which gateway SDK/flow to invoke, the same way it'd
   * switch on any other opaque id; the customer never sees the value. */
  gatewayId: string
}

/**
 * Tries each enabled+connected payment gateway in priority order (ties
 * broken by whichever comes first from listIntegrationConfigs — set a
 * priority if you need a deterministic order among several enabled
 * gateways). Falls back to the next candidate on any failure — a thrown
 * error, a rejected credential, a network failure — recording the outcome
 * on every attempt via markPaymentAttempt. Throws a single generic message
 * only once every candidate has failed; the specific per-gateway failures
 * are never surfaced to the buyer, only to admins via the Gateway Manager.
 */
export async function createPaymentOrderWithFallback(input: PaymentOrderInput): Promise<RoutedPaymentOrder> {
  const candidates = await routableCandidates()

  for (const candidate of candidates) {
    const adapter = getAdapter(candidate.providerId)
    if (!adapter?.createPaymentOrder) continue

    try {
      const credentials = await getDecryptedCredentials(candidate.providerId)
      const result = await adapter.createPaymentOrder(credentials, candidate.environment, input)
      await markPaymentAttempt(candidate.providerId, true)
      return { gatewayId: candidate.providerId, ...result }
    } catch (error) {
      await markPaymentAttempt(candidate.providerId, false, error instanceof Error ? error.message : "Unknown error")
    }
  }

  throw new Error("Payment is temporarily unavailable. Please try again shortly.")
}

/** Verification always targets whichever gatewayId createPaymentOrderWithFallback actually chose — never re-runs the router. */
export async function verifyPaymentForGateway(gatewayId: string, input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
  const adapter = getAdapter(gatewayId)
  if (!adapter?.verifyPayment) throw new Error(`Gateway "${gatewayId}" doesn't support payment verification.`)

  const config = await getIntegrationConfig(gatewayId)
  const credentials = await getDecryptedCredentials(gatewayId)
  const result = await adapter.verifyPayment(credentials, config.environment, input)
  await markPaymentAttempt(gatewayId, result.ok, result.ok ? undefined : result.message)
  return result
}

/** Refunds always target the exact gateway that originally processed the payment (Order.gatewayId) — never routed by priority. */
export async function refundPaymentForGateway(gatewayId: string, input: RefundInput): Promise<RefundResult> {
  const adapter = getAdapter(gatewayId)
  if (!adapter?.refundPayment) throw new Error(`Gateway "${gatewayId}" doesn't support refunds.`)

  const config = await getIntegrationConfig(gatewayId)
  const credentials = await getDecryptedCredentials(gatewayId)
  return adapter.refundPayment(credentials, config.environment, input)
}

/** Live status pull for a payment whose webhook may have been missed or delayed — used by admin order tooling, not the checkout flow itself. */
export async function syncPaymentStatusForGateway(gatewayId: string, input: PaymentStatusSyncInput): Promise<PaymentStatusSyncResult> {
  const adapter = getAdapter(gatewayId)
  if (!adapter?.syncPaymentStatus) return { status: "unknown" }

  const config = await getIntegrationConfig(gatewayId)
  const credentials = await getDecryptedCredentials(gatewayId)
  return adapter.syncPaymentStatus(credentials, config.environment, input)
}
