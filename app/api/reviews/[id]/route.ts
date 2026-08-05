import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { Review } from "@/types/review"

type RouteContext = { params: Promise<{ id: string }> }

async function recomputeProductRating(productId: string): Promise<void> {
  const db = getAdminDb()
  const snap = await db.collection("reviews").where("productId", "==", productId).get()
  const ratings = snap.docs.map((d) => (d.data() as Review).rating)
  const ratingCount = ratings.length
  const ratingAvg = ratingCount === 0 ? 0 : ratings.reduce((sum, r) => sum + r, 0) / ratingCount
  await db.collection("products").doc(productId).update({ ratingAvg, ratingCount })
}

interface PatchBody {
  sellerReply?: string
}

/** A seller replies to a review on THEIR OWN product — checked here against
 * the product's real sellerId (the reviews rule itself only checks
 * "any approved seller", so this route is what actually enforces
 * ownership for the trusted app flow). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = (await request.json()) as PatchBody
  if (!body.sellerReply?.trim()) {
    return NextResponse.json({ error: "Reply text is required." }, { status: 400 })
  }

  const db = getAdminDb()
  const ref = db.collection("reviews").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Review not found." }, { status: 404 })
  const review = snap.data() as Review

  const productSnap = await db.collection("products").doc(review.productId).get()
  if (!productSnap.exists || productSnap.data()!.sellerId !== auth.uid) {
    return NextResponse.json({ error: "You can only reply to reviews on your own products." }, { status: 403 })
  }

  await ref.update({ sellerReply: body.sellerReply.trim() })
  return NextResponse.json({ ok: true })
}

/** Admin moderation — delete-only (see firestore.rules' reviews rule /
 * types/review.ts doc comment: reviews go live immediately, no approval
 * queue, so removal is the one moderation lever). */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "reviews")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("reviews").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Review not found." }, { status: 404 })
  const review = snap.data() as Review

  await ref.delete()
  await recomputeProductRating(review.productId)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "review.delete",
    targetType: "review",
    targetId: id,
    after: { productId: review.productId, buyerId: review.buyerId },
  })

  return NextResponse.json({ ok: true })
}
