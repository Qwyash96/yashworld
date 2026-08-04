import { collection, getDocs } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Banner } from "@/types/banner"

const COLLECTION = "banners"

/** Every currently-live banner (active, and within its optional startAt/endAt
 * window), lowest `order` first — banners/{id} is public-read (see
 * firestore.rules), no admin auth needed. Never throws — an empty hero
 * slider is better than a broken homepage. */
export async function getActiveBanners(): Promise<Banner[]> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION))
    const now = new Date().toISOString()
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Banner)
      .filter((b) => b.active && (!b.startAt || b.startAt <= now) && (!b.endAt || b.endAt >= now))
      .sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error(toServiceError("Failed to fetch active banners", error).message)
    return []
  }
}
