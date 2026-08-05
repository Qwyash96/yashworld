import { collection, doc, getDoc, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Review } from "@/types/review"

/** Every review for a product, newest first — reviews/{id} is public-read
 * (see firestore.rules), no auth needed. Never throws — an empty review
 * list is better than a broken product page. */
export async function getReviewsForProduct(productId: string): Promise<Review[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, "reviews"), where("productId", "==", productId), orderBy("createdAt", "desc")),
    )
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Review)
  } catch (error) {
    console.error(toServiceError(`Failed to fetch reviews for product "${productId}"`, error).message)
    return []
  }
}

/** A buyer's own reviews, across all their orders — used to show
 * "Edit Review" vs "Write a Review" on their order history. */
export async function getReviewsByBuyer(buyerId: string): Promise<Review[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, "reviews"), where("buyerId", "==", buyerId), orderBy("createdAt", "desc")),
    )
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Review)
  } catch (error) {
    console.error(toServiceError(`Failed to fetch reviews for buyer "${buyerId}"`, error).message)
    return []
  }
}

/** Direct doc-ID lookup (`{orderId}_{productId}`, see types/review.ts) — lets
 * the order page know, per delivered item, whether to render "Write a
 * Review" or "Edit Review" without a query. */
export async function getReview(orderId: string, productId: string): Promise<Review | null> {
  try {
    const snap = await getDoc(doc(db, "reviews", `${orderId}_${productId}`))
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Review) : null
  } catch (error) {
    console.error(toServiceError(`Failed to fetch review for order "${orderId}" / product "${productId}"`, error).message)
    return null
  }
}

/** Admin: every review, newest first — reviews/{id} is public-read (see
 * firestore.rules), so this needs no special credentials. */
export async function getAllReviews(): Promise<Review[]> {
  try {
    const snapshot = await getDocs(query(collection(db, "reviews"), orderBy("createdAt", "desc")))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Review)
  } catch (error) {
    throw toServiceError("Failed to fetch reviews", error)
  }
}
