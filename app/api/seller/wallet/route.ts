import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import type { WithdrawalRequest } from "@/types/wallet"

/** A seller's own wallet + their own withdrawal request history. */
export async function GET(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [wallet, withdrawalsSnap] = await Promise.all([
    recomputeSellerWallet(auth.uid),
    getAdminDb().collection("withdrawalRequests").where("sellerId", "==", auth.uid).orderBy("requestedAt", "desc").get(),
  ])

  const withdrawals = withdrawalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithdrawalRequest)
  return NextResponse.json({ wallet, withdrawals })
}
