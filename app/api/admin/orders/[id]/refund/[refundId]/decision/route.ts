import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { writeAuditLog } from "@/lib/audit-log"
import { decideRefundRequest } from "@/lib/refund-service"

type RouteContext = { params: Promise<{ id: string; refundId: string }> }

interface DecisionBody {
  decision?: "Refunded" | "Failed" | "Rejected"
  note?: string
}

/**
 * A Finance Admin's manual completion of a COD refund record — there is no
 * live payment gateway for cash the courier collected, so an "Approved" COD
 * refund sits as a finance payout/refund record until someone here confirms
 * the money actually left the business (or that it didn't/won't). Never
 * reachable for a prepaid refund, which lib/refund-service.ts's
 * createRefundRequest already drives to a terminal state itself.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id, refundId } = await params
  const body = (await request.json().catch(() => ({}))) as DecisionBody
  if (body.decision !== "Refunded" && body.decision !== "Failed" && body.decision !== "Rejected") {
    return NextResponse.json({ error: "A decision ('Refunded', 'Failed', or 'Rejected') is required." }, { status: 400 })
  }

  try {
    const refund = await decideRefundRequest(id, refundId, body.decision, body.note, { uid: auth.uid, email: auth.email })

    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "order.refund_decision",
      targetType: "order",
      targetId: id,
      after: { refundId, decision: body.decision, note: body.note, amount: refund.amount },
    })

    return NextResponse.json({ ok: true, refund })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update refund." }, { status: 400 })
  }
}
