import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto"
import { getAdapter, listAdapters } from "@/lib/integrations/registry"
import type { IntegrationConfig, IntegrationEnvironment, IntegrationHealth, MaskedIntegrationConfig } from "@/types/integrations"

const COLLECTION = "integrations"

function defaultConfig(providerId: string): IntegrationConfig {
  const adapter = getAdapter(providerId)
  return {
    providerId,
    category: adapter?.category ?? "payment",
    enabled: false,
    environment: "sandbox",
    credentials: {},
    settings: Object.fromEntries((adapter?.settingFields ?? []).map((field) => [field.key, field.default])),
    connected: false,
    health: "unknown",
    updatedAt: new Date(0).toISOString(),
    updatedBy: "",
  }
}

export async function getIntegrationConfig(providerId: string): Promise<IntegrationConfig> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(providerId).get()
  const defaults = defaultConfig(providerId)
  if (!snapshot.exists) return defaults

  const data = snapshot.data() as Partial<IntegrationConfig>
  return {
    ...defaults,
    ...data,
    credentials: { ...data.credentials },
    settings: { ...defaults.settings, ...data.settings },
  }
}

/** One entry per registered adapter, even if never configured yet — drives the admin listing page. */
export async function listIntegrationConfigs(): Promise<IntegrationConfig[]> {
  const snapshot = await getAdminDb().collection(COLLECTION).get()
  const stored = new Map(snapshot.docs.map((doc) => [doc.id, doc.data() as Partial<IntegrationConfig>]))

  return listAdapters().map((adapter) => {
    const defaults = defaultConfig(adapter.id)
    const data = stored.get(adapter.id)
    if (!data) return defaults
    return { ...defaults, ...data, credentials: { ...data.credentials }, settings: { ...defaults.settings, ...data.settings } }
  })
}

export function maskIntegrationConfig(config: IntegrationConfig): MaskedIntegrationConfig {
  const { credentials, ...rest } = config
  const credentialsSet = Object.fromEntries(Object.keys(credentials).map((key) => [key, !!credentials[key]]))
  return { ...rest, credentialsSet }
}

export interface SaveIntegrationPatch {
  enabled?: boolean
  environment?: IntegrationEnvironment
  /** Plaintext, keyed by credentialFields[].key — a blank/missing value leaves the currently stored secret alone. */
  credentials?: Record<string, string>
  settings?: Record<string, unknown>
  isDefault?: boolean
  priority?: number
}

export async function saveIntegrationConfig(
  providerId: string,
  patch: SaveIntegrationPatch,
  updatedBy: string,
): Promise<IntegrationConfig> {
  const adapter = getAdapter(providerId)
  if (!adapter) throw new Error(`Unknown integration provider "${providerId}".`)

  const current = await getIntegrationConfig(providerId)
  const nextCredentials = { ...current.credentials }
  if (patch.credentials) {
    for (const field of adapter.credentialFields) {
      const value = patch.credentials[field.key]
      if (value && value.trim()) nextCredentials[field.key] = encryptSecret(value.trim())
    }
  }

  const write: Partial<IntegrationConfig> = {
    providerId,
    category: adapter.category,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.environment !== undefined ? { environment: patch.environment } : {}),
    credentials: nextCredentials,
    ...(patch.settings ? { settings: { ...current.settings, ...patch.settings } } : {}),
    ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy,
  }

  await getAdminDb().collection(COLLECTION).doc(providerId).set(write, { merge: true })
  return getIntegrationConfig(providerId)
}

/** Payment category only — marking one provider default clears isDefault on every other payment adapter. */
export async function setDefaultPaymentGateway(providerId: string): Promise<void> {
  const db = getAdminDb()
  const batch = db.batch()
  for (const adapter of listAdapters()) {
    if (adapter.category !== "payment") continue
    batch.set(db.collection(COLLECTION).doc(adapter.id), { isDefault: adapter.id === providerId }, { merge: true })
  }
  await batch.commit()
}

export async function getDecryptedCredentials(providerId: string): Promise<Record<string, string>> {
  const config = await getIntegrationConfig(providerId)
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(config.credentials)) {
    if (value) result[key] = decryptSecret(value)
  }
  return result
}

/** Existing decrypted credentials with any newly-submitted plaintext values
 * overlaid (blank/missing patch fields keep the existing value) — the set to
 * verifyConnection() against BEFORE persisting a credentials save, so an
 * invalid save is rejected without ever being written. */
export async function buildCandidateCredentials(
  providerId: string,
  patchCredentials: Record<string, string> | undefined,
): Promise<Record<string, string>> {
  const existing = await getDecryptedCredentials(providerId)
  if (!patchCredentials) return existing
  const merged = { ...existing }
  for (const [key, value] of Object.entries(patchCredentials)) {
    if (value && value.trim()) merged[key] = value.trim()
  }
  return merged
}

export async function markVerified(providerId: string, ok: boolean, health: IntegrationHealth): Promise<void> {
  await getAdminDb()
    .collection(COLLECTION)
    .doc(providerId)
    .set({ connected: ok, health, lastVerifiedAt: new Date().toISOString() }, { merge: true })
}

export async function markSynced(providerId: string): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(providerId).set({ lastSyncAt: new Date().toISOString() }, { merge: true })
}

/** Payment category only — called by lib/payment-router.ts after every real
 * checkout attempt against a gateway (never by the manual "Verify
 * Connection"/"Test" buttons, which use markVerified instead). Drives the
 * admin Gateway Manager's live "Last successful/failed transaction" display. */
export async function markPaymentAttempt(providerId: string, ok: boolean, message?: string): Promise<void> {
  const now = new Date().toISOString()
  await getAdminDb()
    .collection(COLLECTION)
    .doc(providerId)
    .set(ok ? { lastSuccessAt: now } : { lastFailureAt: now, lastFailureMessage: message ?? "Unknown error" }, { merge: true })
}
