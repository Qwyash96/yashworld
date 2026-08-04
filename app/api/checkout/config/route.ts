import { NextResponse } from "next/server"
import { getPaymentSettings } from "@/lib/payment-settings"
import type { PublicCheckoutConfig } from "@/types/payment-settings"

/** Public, unauthenticated — the buyer checkout page calls this to know
 * which payment methods to show. Deliberately returns only `methods`,
 * `checkout` and `paymentLink`; never keyId/keySecret/mode/connected. */
export async function GET() {
  const settings = await getPaymentSettings()
  const config: PublicCheckoutConfig = {
    methods: settings.methods,
    checkout: settings.checkout,
    ...(settings.paymentLink ? { paymentLink: settings.paymentLink } : {}),
  }
  return NextResponse.json(config)
}
