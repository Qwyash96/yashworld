/** Firestore `platformSettings/commission` — the single, admin-editable
 * commission rate applied to every sale. Same shape/pattern as
 * types/payment-settings.ts's PaymentSettings. */
export interface PlatformSettings {
  defaultCommissionPercent: number
  updatedAt: string
}

/** Firestore `platformSettings/general`. */
export interface GeneralSettings {
  siteName: string
  supportEmail: string
  supportPhone: string
  maintenanceMode: boolean
  updatedAt: string
}

/**
 * Firestore `platformSettings/shipping`. Admin-editable and persisted for
 * real, but — deliberately, and documented on the settings page itself —
 * NOT YET read by the live checkout pricing engine (lib/order-finalize.ts
 * still uses the hardcoded rates in lib/shipping.ts for the actual charge).
 * Wiring this in risks the create-order/verify amount-match check
 * disagreeing mid-checkout if the rate changed between those two calls —
 * a real payment-correctness risk not worth taking on for an admin
 * settings nicety. Flagged explicitly rather than silently wired halfway.
 */
export interface ShippingSettings {
  standardRate: number
  standardFreeThreshold: number
  expressRate: number
  updatedAt: string
}

/**
 * Firestore `platformSettings/paymentMethods` — which checkout instruments
 * the storefront offers, admin-controlled and completely independent of any
 * specific payment gateway's credentials. Previously these lived as
 * settingFields on the Razorpay integration itself (a leftover of the old
 * paymentSettings/config -> integrations/razorpay migration) — moved here so
 * "is UPI on" isn't tied to which gateway happens to process it. See
 * lib/payment-router.ts for how an enabled method is actually routed to a
 * gateway at checkout.
 */
export interface PaymentMethodsSettings {
  methods: {
    upi: boolean
    cards: boolean
    netbanking: boolean
    wallet: boolean
    emi: boolean
    cod: boolean
  }
  updatedAt: string
}

export interface TrustBadge {
  icon: "shield" | "truck" | "rotate-ccw" | "badge-check" | "headset" | "leaf"
  title: string
  description: string
}

/** Firestore `platformSettings/trustBadges` — the homepage's trust-badge
 * strip (e.g. "Secure Payments", "Verified Sellers"), fully admin-editable. */
export interface TrustBadgesSettings {
  badges: TrustBadge[]
  updatedAt: string
}

/** Firestore `platformSettings/adPricing` — the real, admin-editable fee
 * (in rupees) a seller pays to run a Sponsored Ad for each offered
 * duration. Looked up server-side when a seller starts a promotion
 * (app/api/ads/create-order) — never client-supplied. */
export interface AdPricingSettings {
  feeByDurationDays: Record<"1" | "3" | "7" | "15" | "30", number>
  updatedAt: string
}
