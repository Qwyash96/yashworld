import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { auth, db } from "@/services/firebase/client"
import type { AdDurationDays, AdPosition, SponsoredAd } from "@/types/sponsored-ad"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function parseResult<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Request failed." }
  return { ok: true, data: body as T }
}

/** A seller's own promotions — sponsoredAds/{id} is directly client-readable
 * for the owning seller (see firestore.rules), no API route needed. */
export async function getMySponsoredAds(uid: string): Promise<SponsoredAd[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, "sponsoredAds"), where("sellerId", "==", uid), orderBy("createdAt", "desc")),
    )
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SponsoredAd)
  } catch (error) {
    console.error("[seller-ads-client] failed to list own ads:", error)
    return []
  }
}

export async function createAdOrder(input: {
  productId: string
  durationDays: AdDurationDays
  position: AdPosition
}): Promise<
  | { ok: true; adId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string }
  | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/ads/create-order", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ adId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string }>(
    response,
  )
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function verifyAdPayment(input: {
  adId: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/ads/verify", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ ok: true }>(response)
  if (!result.ok) return result
  return { ok: true }
}
