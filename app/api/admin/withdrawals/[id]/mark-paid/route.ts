import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { writeAuditLog } from "@/lib/audit-log"
import type { WithdrawalRequest } from "@/types/wallet"

type RouteContext = { params: Promise<{ id: string }> }

/** Records that the withdrawal was actually paid out (e.g. bank transfer completed outside this system). */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("withdrawalRequests").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Withdrawal request not found." }, { status: 404 })

  const withdrawal = snap.data() as WithdrawalRequest
  if (withdrawal.status !== "approved") {
    return NextResponse.json({ error: `Only an approved withdrawal can be marked paid (current status: "${withdrawal.status}").` }, { status: 400 })
  }

  const now = new Date().toISOString()
  await ref.update({ status: "paid", paidAt: now })
  await recomputeSellerWallet(withdrawal.sellerId)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "withdrawal.mark_paid",
    targetType: "withdrawalRequest",
    targetId: id,
    after: { status: "paid" },
  })

  return NextResponse.json({ ok: true })
}
