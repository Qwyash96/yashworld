import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { SocialLinks } from "@/types/site-settings"

const COLLECTION = "siteSettings"
const SOCIAL_DOC_ID = "social"

export async function getSocialLinks(): Promise<SocialLinks> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(SOCIAL_DOC_ID).get()
  if (!snapshot.exists) return {}
  return snapshot.data() as SocialLinks
}

export async function saveSocialLinks(patch: Partial<SocialLinks>): Promise<SocialLinks> {
  const ref = getAdminDb().collection(COLLECTION).doc(SOCIAL_DOC_ID)
  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  const snapshot = await ref.get()
  return snapshot.data() as SocialLinks
}
