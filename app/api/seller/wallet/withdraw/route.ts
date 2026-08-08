import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { round2 } from "@/lib/utils"
import { readSequentialIdForTransaction } from "@/lib/sequential-id"
import type { Order } from "@/types/order"
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

  const now = new Date().toISOString()
  const ref = db.collection("withdrawalRequests").doc()

  try {
    // Balance-check-then-write, inside one transaction — otherwise two
    // near-simultaneous requests (double-click, two tabs) could both read
    // the same available balance before either write commits, and both
    // pass, letting a seller request more than they actually have
    // available. Re-derives just the "available now" figure
    // recomputeSellerWallet also computes (released - reserved - withdrawn),
    // reading transactionally so it's atomic against a concurrent request.
    await db.runTransaction(async (tx) => {
      const [ordersSnap, withdrawalsSnap, settlementNumberMint] = await Promise.all([
        tx.get(db.collection("orders").where("sellerIds", "array-contains", auth.uid)),
        tx.get(db.collection("withdrawalRequests").where("sellerId", "==", auth.uid)),
        readSequentialIdForTransaction(tx, "settlement"),
      ])

      let releasedTotal = 0
      for (const doc of ordersSnap.docs) {
        const order = doc.data() as Order
        const sellerOrder = order.sellerOrders.find((so) => so.sellerId === auth.uid)
        if (sellerOrder?.payoutStatus === "Released") releasedTotal += sellerOrder.payoutAmount
      }

      let reservedTotal = 0
      let withdrawnTotal = 0
      for (const doc of withdrawalsSnap.docs) {
        const wr = doc.data() as WithdrawalRequest
        if (wr.status === "requested" || wr.status === "approved") reservedTotal += wr.amount
        else if (wr.status === "paid") withdrawnTotal += wr.amount
      }

      const available = round2(Math.max(0, releasedTotal - reservedTotal - withdrawnTotal))
      if (amount > available) {
        throw new Error(`You can withdraw up to ${available}.`)
      }

      settlementNumberMint.commit()

      const withdrawalRequest: Omit<WithdrawalRequest, "id"> = {
        settlementNumber: settlementNumberMint.id,
        sellerId: auth.uid,
        amount,
        status: "requested",
        requestedAt: now,
      }
      tx.set(ref, withdrawalRequest)
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to request withdrawal." },
      { status: 400 },
    )
  }

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
