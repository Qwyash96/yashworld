import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import type { WithdrawalRequest } from "@/types/wallet"
import type { AdminNotificationInput } from "@/types/notification"

interface WithdrawBody {
  amount?: number
}

export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = getAdminDb()
  const applicationSnap = await db.collection("sellerApplications").doc(auth.uid).get()
  if (applicationSnap.data()?.status !== "approved") {
    return NextResponse.json({ error: "Only approved sellers can request a withdrawal." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as WithdrawBody
  const amount = body.amount
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid withdrawal amount." }, { status: 400 })
  }

  const wallet = await recomputeSellerWallet(auth.uid)
  if (amount > wallet.balance) {
    return NextResponse.json({ error: `You can withdraw up to ${wallet.balance}.` }, { status: 400 })
  }

  const now = new Date().toISOString()
  const ref = db.collection("withdrawalRequests").doc()
  const withdrawalRequest: Omit<WithdrawalRequest, "id"> = {
    sellerId: auth.uid,
    amount,
    status: "requested",
    requestedAt: now,
  }
  await ref.set(withdrawalRequest)

  const notification: AdminNotificationInput = {
    type: "withdrawal_requested",
    targetPermission: "payments",
    title: "Withdrawal requested",
    message: `A seller requested a withdrawal of ${amount}.`,
    relatedType: "withdrawalRequest",
    relatedId: ref.id,
  }
  await db.collection("notifications").add({ ...notification, createdAt: now })

  await recomputeSellerWallet(auth.uid)

  return NextResponse.json({ id: ref.id })
}
