import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import type { WithdrawalRequest } from "@/types/wallet"

type RouteContext = { params: Promise<{ uid: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const [wallet, withdrawalsSnap] = await Promise.all([
    recomputeSellerWallet(uid),
    getAdminDb().collection("withdrawalRequests").where("sellerId", "==", uid).orderBy("requestedAt", "desc").get(),
  ])

  const withdrawals = withdrawalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithdrawalRequest)
  return NextResponse.json({ wallet, withdrawals })
}
