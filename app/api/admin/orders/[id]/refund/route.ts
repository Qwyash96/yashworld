import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import { computeRefundBreakdown, createRefundRequest, getRefundHistory } from "@/lib/refund-service"
import type { Order } from "@/types/order"
import type { AdminNotificationInput } from "@/types/notification"

type RouteContext = { params: Promise<{ id: string }> }

interface RefundBody {
  sellerId?: string
  mode?: "full" | "manual"
  amount?: number
  reason?: string
}

/**
 * GET: everything Admin -> Finance -> Return/Refund needs to render one
 * order's refund panel before any action is taken — the order itself, an
 * eligible-refund breakdown for the whole order and (for a multi-seller
 * order) each seller's own portion, and the full refund history/audit
 * trail. Read-only, same "payments" permission gate as the mutating routes
 * below, so this never leaks buyer/seller order data to an unrelated role.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const snap = await db.collection("orders").doc(id).get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = { id: snap.id, ...snap.data() } as Order

  const [orderScope, sellerScopes, refunds] = await Promise.all([
    computeRefundBreakdown(order),
    Promise.all(order.sellerOrders.map(async (so) => ({ sellerId: so.sellerId, breakdown: await computeRefundBreakdown(order, so.sellerId) }))),
    getRefundHistory(id),
  ])

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      contactEmail: order.contactEmail,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totals: order.totals,
      totalRefundedAmount: order.totalRefundedAmount ?? 0,
      sellerOrders: order.sellerOrders.map((so) => ({ sellerId: so.sellerId, status: so.status, itemCount: so.items.length })),
    },
    scopes: { order: orderScope, sellers: sellerScopes },
    refunds,
  })
}

/**
 * POST: creates and (for a prepaid order) immediately processes one refund
 * request — see lib/refund-service.ts's createRefundRequest for the full
 * Pending->Approved->Processing->Refunded/Failed lifecycle, gateway call,
 * and duplicate-refund guard. `approvedBy` is always the verified caller —
 * never accepted from the request body, so a buyer or seller (who can't
 * reach this "payments"-gated route at all) or even a spoofed admin
 * request body can never attribute a refund to someone else.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const snap = await db.collection("orders").doc(id).get()
  if (!snap.exists) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  const order = { id: snap.id, ...snap.data() } as Order

  const body = (await request.json().catch(() => ({}))) as RefundBody
  if (body.mode !== "full" && body.mode !== "manual") {
    return NextResponse.json({ error: "A refund mode ('full' or 'manual') is required." }, { status: 400 })
  }
  if (body.sellerId && !order.sellerOrders.some((so) => so.sellerId === body.sellerId)) {
    return NextResponse.json({ error: "That seller has no items on this order." }, { status: 400 })
  }

  try {
    const { refund } = await createRefundRequest({
      order,
      sellerId: body.sellerId,
      mode: body.mode,
      amount: body.amount,
      reason: body.reason,
      approver: { uid: auth.uid, email: auth.email },
    })

    if (refund.status === "Refunded") {
      const notification: AdminNotificationInput = {
        type: "refund_issued",
        targetPermission: "payments",
        title: "Refund issued",
        message: `Order #${order.orderNumber ?? id.slice(0, 8)} was refunded (${refund.amount})${body.sellerId ? " — one seller" : ""}.`,
        relatedType: "order",
        relatedId: id,
      }
      await db.collection("notifications").add({ ...notification, createdAt: new Date().toISOString() })
    }

    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "order.refund_request",
      targetType: "order",
      targetId: id,
      after: {
        refundId: refund.id,
        sellerId: body.sellerId,
        mode: refund.mode,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
      },
    })

    return NextResponse.json({ ok: true, refund })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process refund." }, { status: 400 })
  }
}
