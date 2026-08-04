import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { writeAuditLog } from "@/lib/audit-log"
import type { WithdrawalRequest } from "@/types/wallet"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("withdrawalRequests").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Withdrawal request not found." }, { status: 404 })

  const withdrawal = snap.data() as WithdrawalRequest
  if (withdrawal.status !== "requested") {
    return NextResponse.json({ error: `Cannot approve a withdrawal that is already "${withdrawal.status}".` }, { status: 400 })
  }

  const now = new Date().toISOString()
  await ref.update({ status: "approved", decidedAt: now, decidedBy: auth.uid })
  await recomputeSellerWallet(withdrawal.sellerId)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "withdrawal.approve",
    targetType: "withdrawalRequest",
    targetId: id,
    after: { status: "approved" },
  })

  return NextResponse.json({ ok: true })
}
