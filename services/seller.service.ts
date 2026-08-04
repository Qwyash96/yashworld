import { collection, doc, getDoc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type {
  Seller,
  SellerApplication,
  SellerApplicationInput,
  SellerApplicationStatus,
  SellerKycDocs,
} from "@/types/seller"
import type { AdminNotificationInput } from "@/types/notification"

const SELLERS_COLLECTION = "sellers"
const APPLICATIONS_COLLECTION = "sellerApplications"

/** Public storefront profile — only exists once an application is approved. */
export async function getSellerProfile(uid: string): Promise<Seller | null> {
  try {
    const snapshot = await getDoc(doc(db, SELLERS_COLLECTION, uid))
    if (!snapshot.exists()) return null
    return snapshot.data() as Seller
  } catch (error) {
    throw toServiceError(`Failed to fetch seller profile "${uid}"`, error)
  }
}

/** Every approved seller, newest first — sellers/{uid} is public-read (see
 * firestore.rules), no admin auth needed. Never throws — an empty homepage
 * section is better than a broken one. */
export async function getApprovedSellers(): Promise<Seller[]> {
  try {
    const q = query(collection(db, SELLERS_COLLECTION), where("status", "==", "approved"), orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as Seller)
  } catch (error) {
    console.error(toServiceError("Failed to fetch approved sellers", error).message)
    return []
  }
}

/** Admin-curated subset of getApprovedSellers() for the homepage's Featured Sellers section. */
export async function getFeaturedSellers(): Promise<Seller[]> {
  const sellers = await getApprovedSellers()
  return sellers.filter((s) => s.featured)
}

/** The caller's own KYC application (or an admin's view of someone else's). */
export async function getSellerApplication(uid: string): Promise<SellerApplication | null> {
  try {
    const snapshot = await getDoc(doc(db, APPLICATIONS_COLLECTION, uid))
    if (!snapshot.exists()) return null
    return snapshot.data() as SellerApplication
  } catch (error) {
    throw toServiceError(`Failed to fetch seller application "${uid}"`, error)
  }
}

/** Submits or resubmits a seller application — always resets status to "pending". */
export async function submitSellerApplication(input: SellerApplicationInput, kyc: SellerKycDocs): Promise<void> {
  try {
    const now = new Date().toISOString()
    const application: SellerApplication = {
      ...input,
      kyc: { ...kyc, submittedAt: now },
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }

    // Atomic with a notification doc — see firestore.rules' narrowly-scoped
    // notifications create rule, which only allows this exact event type,
    // bound to the caller's own uid.
    const notification: AdminNotificationInput = {
      type: "seller_application_submitted",
      targetPermission: "seller_management",
      title: "New seller application",
      message: `${input.shopName} (${input.fullName}) applied to sell.`,
      relatedType: "sellerApplication",
      relatedId: input.uid,
    }

    const batch = writeBatch(db)
    batch.set(doc(db, APPLICATIONS_COLLECTION, input.uid), application)
    batch.set(doc(collection(db, "notifications")), { ...notification, createdAt: now })
    await batch.commit()
  } catch (error) {
    throw toServiceError(`Failed to submit seller application for "${input.uid}"`, error)
  }
}

/** Admin queue: all applications in a given status, newest first. */
export async function getSellerApplicationsByStatus(
  status: SellerApplicationStatus,
): Promise<SellerApplication[]> {
  try {
    const q = query(
      collection(db, APPLICATIONS_COLLECTION),
      where("status", "==", status),
      orderBy("createdAt", "desc"),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as SellerApplication)
  } catch (error) {
    throw toServiceError(`Failed to fetch "${status}" seller applications`, error)
  }
}
