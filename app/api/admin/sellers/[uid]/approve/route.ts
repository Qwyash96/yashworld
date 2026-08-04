import { NextResponse, type NextRequest } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"

type RouteContext = { params: Promise<{ uid: string }> }

/**
 * Approves a seller application. Two paths:
 * - "pending" -> mints the next sequential Seller ID (SEL000001, ...) via an
 *   atomic counter transaction and creates the public sellers/{uid} mirror.
 * - "suspended"/"banned" -> reactivation: flips both docs back to "approved"
 *   without touching the counter or minting a new ID, and re-enables the
 *   Firebase Auth account if a ban had disabled it.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "seller_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const db = getAdminDb()
  const applicationRef = db.collection("sellerApplications").doc(uid)
  const counterRef = db.collection("counters").doc("sellerId")
  const sellerRef = db.collection("sellers").doc(uid)

  try {
    const result = await db.runTransaction(async (tx) => {
      const applicationSnap = await tx.get(applicationRef)
      if (!applicationSnap.exists) throw new Error("NOT_FOUND")
      const application = applicationSnap.data()!
      const now = new Date().toISOString()

      if (application.status === "suspended" || application.status === "banned") {
        if (!application.sellerId) throw new Error("NOT_FOUND")
        tx.update(applicationRef, { status: "approved", rejectionReason: FieldValue.delete(), updatedAt: now })
        tx.update(sellerRef, { status: "approved" })
        return { sellerId: application.sellerId as string, wasBanned: application.status === "banned" }
      }

      if (application.status !== "pending") throw new Error("NOT_PENDING")

      const counterSnap = await tx.get(counterRef)
      const next = (counterSnap.data()?.value ?? 0) + 1
      const sellerId = `SEL${String(next).padStart(6, "0")}`

      tx.set(counterRef, { value: next })
      tx.update(applicationRef, {
        status: "approved",
        sellerId,
        rejectionReason: FieldValue.delete(),
        updatedAt: now,
      })
      tx.set(sellerRef, {
        uid,
        shopName: application.shopName,
        status: "approved",
        sellerId,
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: now,
      })

      return { sellerId, wasBanned: false }
    })

    if (result.wasBanned) {
      await getAdminAuth().updateUser(uid, { disabled: false }).catch(() => {})
    }

    return NextResponse.json({ sellerId: result.sellerId })
  } catch (error) {
    const message = (error as Error).message
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Seller application not found." }, { status: 404 })
    }
    if (message === "NOT_PENDING") {
      return NextResponse.json({ error: "Only pending applications can be approved." }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to approve seller." }, { status: 500 })
  }
}
