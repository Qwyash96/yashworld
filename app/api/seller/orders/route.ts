import { NextResponse, type NextRequest } from "next/server"
import { requireApprovedSeller } from "@/lib/seller-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { redactOrderForSeller } from "@/lib/seller-order-redaction"
import type { Order } from "@/types/order"

/**
 * The seller order list — Admin SDK, not a client Firestore read. Every
 * order the seller has items on is redacted (buyer phone/email stripped,
 * see lib/seller-order-redaction.ts) before it's serialized into the
 * response, so those fields never reach the seller's browser at all. Mirrors
 * app/api/seller/wallet/route.ts's GET pattern.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedSeller(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = getAdminDb()
  const snap = await db.collection("orders").where("sellerIds", "array-contains", auth.uid).orderBy("createdAt", "desc").get()
  const orders = snap.docs.map((d) => redactOrderForSeller({ id: d.id, ...d.data() } as Order))

  return NextResponse.json({ orders })
}
