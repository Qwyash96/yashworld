import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { SponsoredAd, AdPosition } from "@/types/sponsored-ad"

/**
 * Every currently-live sponsored ad, grouped by homepage position —
 * status === "approved" AND inside its [startAt, endAt] window ("running"
 * is a derived label, never a stored value — see lib/sponsored-ad-status.ts).
 * sponsoredAds/{id} is public-read for status == 'approved' (see
 * firestore.rules), no auth needed. Never throws — a homepage with no ads
 * in a slot is better than a broken page.
 */
export async function getRunningAdsByPosition(): Promise<Record<AdPosition, SponsoredAd[]>> {
  const empty: Record<AdPosition, SponsoredAd[]> = { hero: [], "after-trending": [], middle: [], bottom: [] }
  try {
    const snapshot = await getDocs(
      query(collection(db, "sponsoredAds"), where("status", "==", "approved"), orderBy("priority", "desc")),
    )
    const now = new Date().toISOString()
    const ads = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SponsoredAd)
      .filter((ad) => (!ad.startAt || ad.startAt <= now) && (!ad.endAt || ad.endAt >= now))

    const grouped = { ...empty }
    for (const ad of ads) grouped[ad.position].push(ad)
    return grouped
  } catch (error) {
    console.error(toServiceError("Failed to fetch sponsored ads", error).message)
    return empty
  }
}
