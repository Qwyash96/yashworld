import { doc, getDoc } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import type { SocialLinks, SiteBranding } from "@/types/site-settings"

/** Public read — siteSettings/social has no secrets, only URLs (see firestore.rules). */
export async function getPublicSocialLinks(): Promise<SocialLinks> {
  try {
    const snapshot = await getDoc(doc(db, "siteSettings", "social"))
    if (!snapshot.exists()) return {}
    return snapshot.data() as SocialLinks
  } catch {
    return {}
  }
}

/** Public read — siteSettings/branding is just a logo URL (see firestore.rules). */
export async function getPublicSiteBranding(): Promise<SiteBranding> {
  try {
    const snapshot = await getDoc(doc(db, "siteSettings", "branding"))
    if (!snapshot.exists()) return {}
    return snapshot.data() as SiteBranding
  } catch {
    return {}
  }
}
