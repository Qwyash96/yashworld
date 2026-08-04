import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { PlatformSettings } from "@/types/platform-settings"

const COLLECTION = "platformSettings"
const DOC_ID = "commission"

/** Safe default for a fresh install — 0% commission until an admin sets a real rate. */
const DEFAULT_SETTINGS: PlatformSettings = {
  defaultCommissionPercent: 0,
  updatedAt: new Date(0).toISOString(),
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(DOC_ID).get()
  if (!snapshot.exists) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<PlatformSettings>) }
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const ref = getAdminDb().collection(COLLECTION).doc(DOC_ID)
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<PlatformSettings>) }
}
