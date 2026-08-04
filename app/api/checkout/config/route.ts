import { NextResponse } from "next/server"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import type { PublicCheckoutConfig } from "@/types/checkout-config"

/** Public, unauthenticated — the buyer checkout page calls this to know
 * which payment methods to show. Deliberately returns only `methods`,
 * `checkout` and `paymentLink`; never keyId/keySecret/connected/health.
 * Reads from integrations/razorpay now (migrated off paymentSettings/config)
 * — this response shape is unchanged, so app/checkout/page.tsx needs no
 * changes at all. */
export async function GET() {
  const [config, credentials] = await Promise.all([
    getIntegrationConfig("razorpay"),
    getDecryptedCredentials("razorpay"),
  ])
  const settings = config.settings as {
    upi: boolean
    cards: boolean
    netbanking: boolean
    wallet: boolean
    emi: boolean
    cod: boolean
    razorpayEnabled: boolean
    codEnabled: boolean
    defaultMethod: "razorpay" | "cod"
  }

  const publicConfig: PublicCheckoutConfig = {
    methods: {
      upi: settings.upi,
      cards: settings.cards,
      netbanking: settings.netbanking,
      wallet: settings.wallet,
      emi: settings.emi,
      cod: settings.cod,
    },
    checkout: {
      razorpayEnabled: settings.razorpayEnabled,
      codEnabled: settings.codEnabled,
      defaultMethod: settings.defaultMethod,
      currency: "INR",
    },
    ...(credentials.paymentLink ? { paymentLink: credentials.paymentLink } : {}),
  }
  return NextResponse.json(publicConfig)
}
