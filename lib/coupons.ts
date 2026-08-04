import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Coupon } from "@/types/coupon"

const COLLECTION = "coupons"

/** Pure — no I/O. Whether a coupon is usable right now, ignoring per-buyer limits. */
export function isCouponCurrentlyValid(coupon: Coupon, now: Date): boolean {
  if (coupon.status !== "active") return false
  if (new Date(coupon.startAt) > now) return false
  if (new Date(coupon.endAt) < now) return false
  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) return false
  return true
}

export async function getCoupon(code: string): Promise<Coupon | null> {
  const snap = await getAdminDb().collection(COLLECTION).doc(code.trim().toUpperCase()).get()
  if (!snap.exists) return null
  return snap.data() as Coupon
}

/** Returns the coupon only if it's currently redeemable (status/window/usage limit) — never a stale or expired one. */
export async function getValidCoupon(code: string, now: Date = new Date()): Promise<Coupon | null> {
  const coupon = await getCoupon(code)
  if (!coupon || !isCouponCurrentlyValid(coupon, now)) return null
  return coupon
}

/** How many times this buyer has already redeemed this coupon — for enforcing usageLimitPerBuyer. */
export async function getBuyerRedemptionCount(couponCode: string, buyerId: string): Promise<number> {
  const snap = await getAdminDb()
    .collection("couponRedemptions")
    .where("couponCode", "==", couponCode.trim().toUpperCase())
    .where("buyerId", "==", buyerId)
    .get()
  return snap.size
}

export async function listCoupons(scope?: "seller" | "global", sellerId?: string): Promise<Coupon[]> {
  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection(COLLECTION)
  if (sellerId) query = query.where("sellerId", "==", sellerId)
  else if (scope) query = query.where("scope", "==", scope)
  const snap = await query.get()
  return snap.docs.map((d) => d.data() as Coupon)
}
