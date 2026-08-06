export type IntegrationCategory = "payment" | "shipping" | "checkout" | "whatsapp" | "email" | "sms" | "analytics"
export type IntegrationEnvironment = "live" | "sandbox"
export type IntegrationHealth = "healthy" | "degraded" | "down" | "unknown"

/**
 * Firestore `integrations/{providerId}` — one doc per provider, the single
 * generic config shape every adapter in lib/integrations/adapters uses.
 * `credentials` values are always AES-256-GCM encrypted before they reach
 * this shape (see lib/integrations/crypto.ts) — nothing in this collection
 * is ever readable without the server-only INTEGRATIONS_ENCRYPTION_KEY, and
 * firestore.rules denies every client read/write outright.
 */
export interface IntegrationConfig {
  providerId: string
  category: IntegrationCategory
  enabled: boolean
  environment: IntegrationEnvironment
  /** Encrypted values, keyed by the adapter's own credentialFields[].key. */
  credentials: Record<string, string>
  /** Keyed by the adapter's own settingFields[].key — module toggles, Auto AWB, etc. */
  settings: Record<string, unknown>
  connected: boolean
  lastVerifiedAt?: string
  lastSyncAt?: string
  health: IntegrationHealth
  /** Payment category only — which gateway checkout falls back to, and in what order. */
  isDefault?: boolean
  priority?: number
  /** Payment category only — set by lib/payment-router.ts after every real
   * createPaymentOrder/verifyPayment attempt (not by the manual "Verify
   * Connection" button, which only ever touches lastVerifiedAt/health/connected).
   * Drives the admin Gateway Manager's "Last successful/failed transaction" display. */
  lastSuccessAt?: string
  lastFailureAt?: string
  lastFailureMessage?: string
  updatedAt: string
  updatedBy: string
}

/** What every admin GET route returns — credentials replaced with presence flags, never the values. */
export type MaskedIntegrationConfig = Omit<IntegrationConfig, "credentials"> & {
  credentialsSet: Record<string, boolean>
}
