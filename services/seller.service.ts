import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type {
  Seller,
  SellerApplication,
  SellerApplicationInput,
  SellerApplicationStatus,
  SellerKycDocs,
} from "@/types/seller"

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
    const application: SellerApplication = {
      ...input,
      kyc: { ...kyc, submittedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await setDoc(doc(db, APPLICATIONS_COLLECTION, input.uid), application)
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
