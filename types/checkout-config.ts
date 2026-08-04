/** The public, buyer-facing shape of Razorpay checkout availability — no
 * credentials, ever. Sourced from integrations/razorpay's settings (see
 * lib/integrations/adapters/razorpay.ts, app/api/checkout/config/route.ts).
 * Kept as its own type rather than folded into types/integrations.ts because
 * it's Razorpay/COD-specific shape, not a generic adapter concept — the
 * other 5 payment adapters don't wire into checkout yet (admin-manageable
 * only, see the Plug-and-Play Integration System plan). */
export interface PaymentMethodFlags {
  upi: boolean
  cards: boolean
  netbanking: boolean
  wallet: boolean
  emi: boolean
  cod: boolean
}

export interface CheckoutSettings {
  razorpayEnabled: boolean
  codEnabled: boolean
  defaultMethod: "razorpay" | "cod"
  currency: "INR"
}

export interface PublicCheckoutConfig {
  methods: PaymentMethodFlags
  checkout: CheckoutSettings
  paymentLink?: string
}
