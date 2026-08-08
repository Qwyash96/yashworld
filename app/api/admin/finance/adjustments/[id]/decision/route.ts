import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { writeAuditLog } from "@/lib/audit-log"
import { decideAdjustment } from "@/lib/finance-adjustment-service"

type RouteContext = { params: Promise<{ id: string }> }

interface DecisionBody {
  decision?: "Approved" | "Rejected"
}

/**
 * Approve or Reject a Pending adjustment — "payments" permission only.
 * Approve applies the effect (lib/wallet-service.ts / lib/refund-service.ts
 * pick it up on their next read) and generates the corresponding Debit/
 * Credit/Adjustment Statement document. There is no edit — a completed
 * (Approved or Rejected) adjustment is immutable; a correction must be a
 * new adjustment with reversesAdjustmentId set (see
 * app/api/admin/finance/adjustments/route.ts's POST).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as DecisionBody
  if (body.decision !== "Approved" && body.decision !== "Rejected") {
    return NextResponse.json({ error: "A decision ('Approved' or 'Rejected') is required." }, { status: 400 })
  }

  try {
    const result = await decideAdjustment(id, body.decision, { uid: auth.uid, email: auth.email })

    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "finance.adjustment_decision",
      targetType: "financeAdjustment",
      targetId: id,
      after: { decision: body.decision, documentId: result.documentId },
    })

    return NextResponse.json({ ok: true, adjustment: result.adjustment, documentId: result.documentId })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update adjustment." }, { status: 400 })
  }
}
