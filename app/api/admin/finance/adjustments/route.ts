import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission, requireAnyPermission } from "@/lib/admin-api-auth"
import { writeAuditLog } from "@/lib/audit-log"
import { createAdjustment, listAdjustments } from "@/lib/finance-adjustment-service"
import type { AdjustmentParty, AdjustmentStatus, AdjustmentType } from "@/types/finance"

/**
 * GET: list Finance Adjustments with filters — reachable by "payments" or
 * "order_management" (Operations Admin reviewing return cases can see the
 * financial adjustment trail, per the permission matrix, without being
 * able to create/approve/reject one).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission(request, ["payments", "order_management"])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const adjustments = await listAdjustments({
    orderId: searchParams.get("orderId") ?? undefined,
    partyType: (searchParams.get("partyType") as AdjustmentParty | null) ?? undefined,
    partyId: searchParams.get("partyId") ?? undefined,
    type: (searchParams.get("type") as AdjustmentType | null) ?? undefined,
    status: (searchParams.get("status") as AdjustmentStatus | null) ?? undefined,
  })

  return NextResponse.json({ adjustments })
}

interface CreateAdjustmentBody {
  orderId?: string
  partyType?: AdjustmentParty
  partyId?: string
  type?: AdjustmentType
  amount?: number
  reason?: string
  notes?: string
  relatedPaymentId?: string
  reversesAdjustmentId?: string
}

/**
 * POST: creates a new Charge/Credit/Refund Adjustment at "Pending" —
 * "payments" permission only (Finance Admin/Super Admin). Buyers and
 * sellers have no route to this at all; Operations Admin can read (GET
 * above) but not write. Amounts and permissions are entirely server-side —
 * the request body is untrusted input, validated fully inside
 * lib/finance-adjustment-service.ts's createAdjustment.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as CreateAdjustmentBody
  if (!body.partyType || !body.partyId || !body.type || body.amount === undefined || !body.reason) {
    return NextResponse.json({ error: "partyType, partyId, type, amount, and reason are required." }, { status: 400 })
  }

  try {
    const adjustment = await createAdjustment(
      {
        orderId: body.orderId,
        partyType: body.partyType,
        partyId: body.partyId,
        type: body.type,
        amount: body.amount,
        reason: body.reason,
        notes: body.notes,
        relatedPaymentId: body.relatedPaymentId,
        reversesAdjustmentId: body.reversesAdjustmentId,
      },
      { uid: auth.uid, email: auth.email },
    )

    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "finance.adjustment_create",
      targetType: "financeAdjustment",
      targetId: adjustment.id,
      after: { ...adjustment },
    })

    return NextResponse.json({ ok: true, adjustment })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create adjustment." }, { status: 400 })
  }
}
