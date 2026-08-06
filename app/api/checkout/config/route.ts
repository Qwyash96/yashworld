import { NextResponse } from "next/server"
import { getDecryptedCredentials } from "@/lib/integrations/config-store"
import { getPaymentMethodsSettings } from "@/lib/platform-settings"
import { hasRoutableGateway } from "@/lib/payment-router"
import type { PublicCheckoutConfig } from "@/types/checkout-config"

/** Public, unauthenticated — the buyer checkout page calls this to know
 * which payment methods to show. Deliberately returns only `methods`,
 * `checkout` and `paymentLink`; never keyId/keySecret/connected/health, and
 * never a gateway name — `methods` is admin-controlled
 * (platformSettings/paymentMethods) independent of any gateway, and
 * `checkout.anyGatewayAvailable` just says whether the payment router
 * (lib/payment-router.ts) currently has anything enabled+connected to use
 * for the 5 online instruments. Which gateway that turns out to be is
 * decided per-request by the router, never here. */
export async function GET() {
  const [methodsSettings, anyGatewayAvailable, razorpayCredentials] = await Promise.all([
    getPaymentMethodsSettings(),
    hasRoutableGateway(),
    // paymentLink is a manual, human-followed fallback URL — not a real API
    // integration, so it stays Razorpay-specific (the only adapter with this
    // credential field) rather than trying to generalize a "backup link"
    // concept across all 6 gateways.
    getDecryptedCredentials("razorpay"),
  ])

  const publicConfig: PublicCheckoutConfig = {
    methods: methodsSettings.methods,
    checkout: {
      anyGatewayAvailable,
      currency: "INR",
    },
    ...(razorpayCredentials.paymentLink ? { paymentLink: razorpayCredentials.paymentLink } : {}),
  }
  return NextResponse.json(publicConfig)
}
