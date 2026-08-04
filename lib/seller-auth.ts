import "server-only"
import type { NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"

type SellerAuthResult = { ok: true; uid: string } | { ok: false; status: number; error: string }

/**
 * Signed in + an approved seller — the shared gate for every seller-facing
 * order-fulfillment route (status updates, courier scheduling, document
 * generation). Previously inlined separately in each route; factored out
 * here since the new fulfillment dashboard adds several more call sites.
 *
 * Does NOT check ownership of a specific order — callers operating on one
 * order still need their own
 * `order.sellerOrders.some((so) => so.sellerId === uid)` check.
 */
export async function requireApprovedSeller(request: NextRequest): Promise<SellerAuthResult> {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return auth

  const applicationSnap = await getAdminDb().collection("sellerApplications").doc(auth.uid).get()
  if (applicationSnap.data()?.status !== "approved") {
    return { ok: false, status: 403, error: "Only approved sellers can perform this action." }
  }
  return { ok: true, uid: auth.uid }
}
