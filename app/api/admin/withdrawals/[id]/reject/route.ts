import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { recomputeSellerWallet } from "@/lib/wallet-service"
import { writeAuditLog } from "@/lib/audit-log"
import type { WithdrawalRequest } from "@/types/wallet"

type RouteContext = { params: Promise<{ id: string }> }

interface RejectBody {
  reason?: string
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection("withdrawalRequests").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Withdrawal request not found." }, { status: 404 })

  const withdrawal = snap.data() as WithdrawalRequest
  if (withdrawal.status !== "requested" && withdrawal.status !== "approved") {
    return NextResponse.json({ error: `Cannot reject a withdrawal that is already "${withdrawal.status}".` }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as RejectBody
  const now = new Date().toISOString()
  await ref.update({
    status: "rejected",
    decidedAt: now,
    decidedBy: auth.uid,
    ...(body.reason?.trim() ? { rejectionReason: body.reason.trim() } : {}),
  })
  // Rejecting frees the reserved amount back into the seller's available balance.
  await recomputeSellerWallet(withdrawal.sellerId)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "withdrawal.reject",
    targetType: "withdrawalRequest",
    targetId: id,
    after: { status: "rejected", reason: body.reason },
  })

  return NextResponse.json({ ok: true })
}
