import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"
import type { Review, ReviewInput } from "@/types/review"

/** Recomputes a product's ratingAvg/ratingCount from its live reviews —
 * always a fresh read-and-average rather than an incremental update, so an
 * edited or deleted review can never leave the aggregate drifted. Buyers
 * can't write products/{id} directly (see firestore.rules), so this is the
 * one place that keeps the two in sync. */
async function recomputeProductRating(productId: string): Promise<void> {
  const db = getAdminDb()
  const snap = await db.collection("reviews").where("productId", "==", productId).get()
  const ratings = snap.docs.map((d) => (d.data() as Review).rating)
  const ratingCount = ratings.length
  const ratingAvg = ratingCount === 0 ? 0 : ratings.reduce((sum, r) => sum + r, 0) / ratingCount
  await db.collection("products").doc(productId).update({ ratingAvg, ratingCount })
}

interface SubmitBody extends Partial<ReviewInput> {
  buyerName?: string
}

/** A buyer submits (or edits — same doc ID, so this is an upsert) a review
 * for one item in one of their own delivered orders. Real purchase
 * verification happens here, not just the rules' "any signed-in user" —
 * the order must be theirs, must contain this product, and that seller
 * portion must actually be Delivered. */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SubmitBody
  if (!body.orderId || !body.productId || !body.rating || !body.buyerName?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
  }
  const rating = Math.round(body.rating)
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 })
  }

  const db = getAdminDb()
  const orderSnap = await db.collection("orders").doc(body.orderId).get()
  if (!orderSnap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = orderSnap.data() as Order
  if (order.buyerId !== auth.uid) {
    return NextResponse.json({ error: "This order doesn't belong to you." }, { status: 403 })
  }

  const sellerOrder = order.sellerOrders.find((so) => so.items.some((item) => item.productId === body.productId))
  if (!sellerOrder) {
    return NextResponse.json({ error: "This product isn't part of that order." }, { status: 400 })
  }
  if (sellerOrder.status !== "Delivered") {
    return NextResponse.json({ error: "You can only review delivered items." }, { status: 403 })
  }

  const reviewId = `${body.orderId}_${body.productId}`
  const ref = db.collection("reviews").doc(reviewId)
  const existing = await ref.get()
  const now = new Date().toISOString()

  const input: Omit<Review, "id"> = {
    orderId: body.orderId,
    productId: body.productId,
    buyerId: auth.uid,
    buyerName: body.buyerName.trim(),
    rating,
    text: body.text?.trim() ?? "",
    images: body.images ?? [],
    ...((existing.data() as Review | undefined)?.sellerReply
      ? { sellerReply: (existing.data() as Review).sellerReply }
      : {}),
    createdAt: existing.exists ? (existing.data() as Review).createdAt : now,
    updatedAt: now,
  }

  await ref.set(input)
  await recomputeProductRating(body.productId)

  return NextResponse.json({ review: { id: reviewId, ...input } })
}
