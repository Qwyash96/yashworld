import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { PlatformSettings, GeneralSettings, ShippingSettings, TrustBadgesSettings } from "@/types/platform-settings"

const COLLECTION = "platformSettings"

/** Safe default for a fresh install — 0% commission until an admin sets a real rate. */
const DEFAULT_SETTINGS: PlatformSettings = {
  defaultCommissionPercent: 0,
  updatedAt: new Date(0).toISOString(),
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc("commission").get()
  if (!snapshot.exists) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<PlatformSettings>) }
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const ref = getAdminDb().collection(COLLECTION).doc("commission")
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<PlatformSettings>) }
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  siteName: "YashWorld",
  supportEmail: "",
  supportPhone: "",
  maintenanceMode: false,
  updatedAt: new Date(0).toISOString(),
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc("general").get()
  if (!snapshot.exists) return DEFAULT_GENERAL_SETTINGS
  return { ...DEFAULT_GENERAL_SETTINGS, ...(snapshot.data() as Partial<GeneralSettings>) }
}

export async function saveGeneralSettings(patch: Partial<GeneralSettings>): Promise<GeneralSettings> {
  const ref = getAdminDb().collection(COLLECTION).doc("general")
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return { ...DEFAULT_GENERAL_SETTINGS, ...(snapshot.data() as Partial<GeneralSettings>) }
}

// lib/shipping.ts's hardcoded values, mirrored here as the default until an
// admin saves real ones — see types/platform-settings.ts's ShippingSettings
// doc comment for why this isn't yet read by the live checkout engine.
const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  standardRate: 15,
  standardFreeThreshold: 250,
  expressRate: 49,
  updatedAt: new Date(0).toISOString(),
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc("shipping").get()
  if (!snapshot.exists) return DEFAULT_SHIPPING_SETTINGS
  return { ...DEFAULT_SHIPPING_SETTINGS, ...(snapshot.data() as Partial<ShippingSettings>) }
}

export async function saveShippingSettings(patch: Partial<ShippingSettings>): Promise<ShippingSettings> {
  const ref = getAdminDb().collection(COLLECTION).doc("shipping")
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return { ...DEFAULT_SHIPPING_SETTINGS, ...(snapshot.data() as Partial<ShippingSettings>) }
}

const DEFAULT_TRUST_BADGES_SETTINGS: TrustBadgesSettings = {
  badges: [
    { icon: "shield", title: "Secure Payments", description: "100% secure checkout, every order" },
    { icon: "badge-check", title: "Verified Sellers", description: "Every seller is KYC-verified" },
    { icon: "rotate-ccw", title: "Easy Returns", description: "Hassle-free return window" },
    { icon: "truck", title: "Fast Delivery", description: "Dispatched within 24 hours" },
  ],
  updatedAt: new Date(0).toISOString(),
}

export async function getTrustBadgesSettings(): Promise<TrustBadgesSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc("trustBadges").get()
  if (!snapshot.exists) return DEFAULT_TRUST_BADGES_SETTINGS
  return { ...DEFAULT_TRUST_BADGES_SETTINGS, ...(snapshot.data() as Partial<TrustBadgesSettings>) }
}

export async function saveTrustBadgesSettings(patch: Partial<TrustBadgesSettings>): Promise<TrustBadgesSettings> {
  const ref = getAdminDb().collection(COLLECTION).doc("trustBadges")
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return { ...DEFAULT_TRUST_BADGES_SETTINGS, ...(snapshot.data() as Partial<TrustBadgesSettings>) }
}
