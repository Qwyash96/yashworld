export type PaymentMode = "test" | "live"

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

/** Firestore `paymentSettings/config` — the single source of truth for
 * payment configuration. Never sent to a client as-is (see
 * lib/payment-settings.ts / app/api/checkout/config for the masked/public
 * views of this). */
export interface PaymentSettings {
  provider: "razorpay"
  /** Derived automatically from the Key ID prefix (rzp_test_/rzp_live_) on
   * save — not a separately user-editable field. Kept for any code that
   * still wants to know which environment a key belongs to; the admin UI
   * itself no longer shows or lets anyone toggle this. */
  mode: PaymentMode
  keyId: string
  keySecret: string
  webhookSecret: string
  connected: boolean
  lastVerifiedAt?: string
  methods: PaymentMethodFlags
  checkout: CheckoutSettings
  /** Optional hosted Razorpay Payment Link — a no-integration-required
   * fallback checkout URL. When set, the buyer checkout page redirects here
   * instead of blocking the buyer if no payment method (Razorpay or COD) is
   * actually available. */
  paymentLink?: string
  updatedAt: string
}

/** What the admin GET route returns — keySecret/webhookSecret replaced with presence flags. */
export type MaskedPaymentSettings = Omit<PaymentSettings, "keySecret" | "webhookSecret"> & {
  keySecretSet: boolean
  webhookSecretSet: boolean
}

/** What the public checkout config route returns — no credentials, but
 * paymentLink is just a URL (not a secret) so it's safe to expose. */
export interface PublicCheckoutConfig {
  methods: PaymentMethodFlags
  checkout: CheckoutSettings
  paymentLink?: string
}
