/** The public, buyer-facing shape of checkout availability — no credentials,
 * no gateway name, ever. `methods` is sourced from
 * platformSettings/paymentMethods (admin-controlled, gateway-agnostic — see
 * types/platform-settings.ts's PaymentMethodsSettings); `checkout.anyGatewayAvailable`
 * just says whether ANY enabled+connected payment gateway currently exists
 * for the router (lib/payment-router.ts) to use for the 5 online instruments
 * — which gateway that ends up being is never surfaced here or anywhere
 * buyer-facing. */
export interface PaymentMethodFlags {
  upi: boolean
  cards: boolean
  netbanking: boolean
  wallet: boolean
  emi: boolean
  cod: boolean
}

export interface CheckoutSettings {
  anyGatewayAvailable: boolean
  currency: "INR"
}

export interface PublicCheckoutConfig {
  methods: PaymentMethodFlags
  checkout: CheckoutSettings
  paymentLink?: string
}
