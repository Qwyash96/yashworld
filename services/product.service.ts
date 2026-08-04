import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import { normalizeProductImages } from "@/lib/product-images"
import type { Product, ProductInput, ScheduledOffer } from "@/types/product"
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore"

const COLLECTION = "products"

/** Every read goes through this so older documents (images as a plain
 * string[]) are always coerced to the current ProductImage[] shape. */
function toProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product {
  const data = snapshot.data()
  return { id: snapshot.id, ...data, images: normalizeProductImages(data.images) } as Product
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, id))
    if (!snapshot.exists()) return null
    return toProduct(snapshot)
  } catch (error) {
    throw toServiceError(`Failed to fetch product "${id}"`, error)
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION))
    return snapshot.docs.map(toProduct)
  } catch (error) {
    throw toServiceError("Failed to fetch products", error)
  }
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), where("categoryId", "==", categoryId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(toProduct)
  } catch (error) {
    throw toServiceError(`Failed to fetch products for category "${categoryId}"`, error)
  }
}

export async function getProductsBySeller(sellerId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), where("sellerId", "==", sellerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(toProduct)
  } catch (error) {
    throw toServiceError(`Failed to fetch products for seller "${sellerId}"`, error)
  }
}

/** A seller's live, public-facing catalog — unlike getProductsBySeller
 * (that seller's own dashboard, every status), this explicitly filters to
 * status == "approved" in the query itself. Firestore rules require every
 * document a query returns to individually satisfy the read rule; a buyer
 * reading someone else's draft/pending/rejected products would fail the
 * whole query, not just skip them, so the filter has to be server-side
 * here rather than a client-side .filter() afterwards. Used by the public
 * seller storefront page. */
export async function getPublicProductsBySeller(sellerId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), where("sellerId", "==", sellerId), where("status", "==", "approved"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(toProduct)
  } catch (error) {
    console.error(toServiceError(`Failed to fetch public products for seller "${sellerId}"`, error).message)
    return []
  }
}

export async function createProduct(input: ProductInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...input,
      ratingAvg: 0,
      ratingCount: 0,
      unitsSold: 0,
      createdAt: new Date().toISOString(),
    })
    return docRef.id
  } catch (error) {
    throw toServiceError("Failed to create product", error)
  }
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...input })
  } catch (error) {
    throw toServiceError(`Failed to update product "${id}"`, error)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, id))
  } catch (error) {
    throw toServiceError(`Failed to delete product "${id}"`, error)
  }
}

/** Seller-side, direct write — same trust level as any other product field (firestore.rules
 * lets an approved seller update their own products with no field restriction). */
export async function setScheduledOffer(id: string, offer: ScheduledOffer): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { scheduledOffer: offer })
  } catch (error) {
    throw toServiceError(`Failed to set a scheduled offer on product "${id}"`, error)
  }
}

export async function clearScheduledOffer(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { scheduledOffer: deleteField() })
  } catch (error) {
    throw toServiceError(`Failed to clear the scheduled offer on product "${id}"`, error)
  }
}

/** For the admin moderation queue. Matches the products composite index (status + createdAt). */
export async function getPendingProducts(): Promise<Product[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(toProduct)
  } catch (error) {
    throw toServiceError("Failed to fetch pending products", error)
  }
}

/** Admin action: makes a product visible in the customer catalog. */
export async function approveProduct(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { status: "approved", rejectionReason: deleteField() })
  } catch (error) {
    throw toServiceError(`Failed to approve product "${id}"`, error)
  }
}

/** Admin action: sends a product back to the seller with a reason — the seller can edit and resubmit as "pending". */
export async function rejectProduct(id: string, reason?: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      status: "rejected",
      ...(reason ? { rejectionReason: reason } : { rejectionReason: deleteField() }),
    })
  } catch (error) {
    throw toServiceError(`Failed to reject product "${id}"`, error)
  }
}
