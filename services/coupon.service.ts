import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Coupon, CouponInput } from "@/types/coupon"

const COLLECTION = "coupons"

export async function getCoupon(code: string): Promise<Coupon | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, code.trim().toUpperCase()))
    if (!snapshot.exists()) return null
    return snapshot.data() as Coupon
  } catch (error) {
    throw toServiceError(`Failed to fetch coupon "${code}"`, error)
  }
}

/** This seller's own coupon codes only — firestore.rules deny reading other sellers' or global coupons here. */
export async function listSellerCoupons(sellerId: string): Promise<Coupon[]> {
  try {
    const q = query(collection(db, COLLECTION), where("sellerId", "==", sellerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as Coupon)
  } catch (error) {
    throw toServiceError(`Failed to fetch coupons for seller "${sellerId}"`, error)
  }
}

/** Direct client write — same trust level as a seller managing their own products. */
export async function createSellerCoupon(input: CouponInput): Promise<void> {
  try {
    const code = input.code.trim().toUpperCase()
    const now = new Date().toISOString()
    const coupon: Coupon = { ...input, code, usedCount: 0, totalDiscountGiven: 0, totalRevenue: 0, createdAt: now, updatedAt: now }
    await setDoc(doc(db, COLLECTION, code), coupon)
  } catch (error) {
    throw toServiceError(`Failed to create coupon "${input.code}"`, error)
  }
}

export async function updateSellerCoupon(
  code: string,
  patch: Partial<Pick<Coupon, "discountValue" | "maxDiscountAmount" | "minOrderValue" | "usageLimit" | "usageLimitPerBuyer" | "startAt" | "endAt" | "status">>,
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, code.trim().toUpperCase()), { ...patch, updatedAt: new Date().toISOString() })
  } catch (error) {
    throw toServiceError(`Failed to update coupon "${code}"`, error)
  }
}

export async function deleteSellerCoupon(code: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, code.trim().toUpperCase()))
  } catch (error) {
    throw toServiceError(`Failed to delete coupon "${code}"`, error)
  }
}
