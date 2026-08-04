import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Seller } from "@/types/seller"
import type { PayoutRow, WithdrawalRequest, WithdrawalRequestStatus } from "@/types/wallet"

const PAGE_SIZE = 25

/** Cross-seller withdrawalRequests list — the platform-wide "Payouts" view.
 * The only other place this data surfaces today is per-seller
 * (app/admin/sellers/[id]/page.tsx's Withdrawals tab, gated by
 * seller_management), which finance never holds — this route is gated on
 * "payments" instead, matching who actually approves/rejects/pays these. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") as WithdrawalRequestStatus | null
  const cursor = searchParams.get("cursor")

  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("withdrawalRequests")
  if (status) query = query.where("status", "==", status)
  query = query.orderBy("requestedAt", "desc")
  if (cursor) query = query.startAfter(cursor)

  const snap = await query.limit(PAGE_SIZE).get()
  const withdrawals = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithdrawalRequest)

  const sellerIds = Array.from(new Set(withdrawals.map((w) => w.sellerId)))
  const sellerDocs = await Promise.all(sellerIds.map((id) => db.collection("sellers").doc(id).get()))
  const shopNames = new Map(sellerDocs.map((doc) => [doc.id, (doc.data() as Seller | undefined)?.shopName ?? doc.id]))

  const payouts: PayoutRow[] = withdrawals.map((w) => ({ ...w, sellerShopName: shopNames.get(w.sellerId) ?? w.sellerId }))
  const lastDoc = snap.docs[snap.docs.length - 1]

  return NextResponse.json({
    payouts,
    nextCursor: lastDoc ? lastDoc.data().requestedAt : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  })
}
