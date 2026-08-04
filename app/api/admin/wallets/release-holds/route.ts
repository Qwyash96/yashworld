import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { writeAuditLog } from "@/lib/audit-log"
import { RETURN_WINDOW_DAYS } from "@/types/order-lifecycle"
import type { Order } from "@/types/order"

/**
 * Releases any sellerOrder still On Hold whose return window has passed —
 * the no-cron-compliant way to do a time-based transition in this app (no
 * scheduled Cloud Functions exist anywhere): invoked when an admin visits
 * /admin/withdrawals (throttled client-side to once/minute) or clicks
 * "Release Eligible Holds". Queries orders.hasHeldPayouts==true (a
 * denormalized flag — Firestore can't query payoutStatus/deliveredAt
 * directly since they're nested inside an array of objects).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = getAdminDb()
  const now = new Date()
  const cutoffMs = RETURN_WINDOW_DAYS * 86_400_000

  const snap = await db.collection("orders").where("hasHeldPayouts", "==", true).get()

  let releasedCount = 0
  const affectedSellerIds = new Set<string>()

  for (const doc of snap.docs) {
    const order = doc.data() as Order
    let changed = false
    const sellerOrders = order.sellerOrders.map((so) => {
      if (
        so.payoutStatus === "Hold" &&
        so.deliveredAt &&
        now.getTime() - new Date(so.deliveredAt).getTime() >= cutoffMs
      ) {
        changed = true
        releasedCount++
        affectedSellerIds.add(so.sellerId)
        return { ...so, payoutStatus: "Released" as const }
      }
      return so
    })

    if (changed) {
      const stillHeld = sellerOrders.some((so) => so.payoutStatus === "Hold")
      await doc.ref.update({ sellerOrders, hasHeldPayouts: stillHeld })
    }
  }

  await Promise.all(Array.from(affectedSellerIds).map((sellerId) => recomputeSellerWallet(sellerId)))

  if (releasedCount > 0) {
    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "wallet.release_holds",
      targetType: "sellerWallet",
      targetId: "bulk",
      after: { releasedCount, sellersAffected: affectedSellerIds.size },
    })
  }

  return NextResponse.json({ releasedCount, sellersAffected: affectedSellerIds.size })
}
