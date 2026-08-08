import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import { refundPaymentForGateway } from "@/lib/payment-router"
import { round2 } from "@/lib/utils"
import { listRefundHistory, listApprovedAdjustments } from "@/lib/finance-ledger-shared"
import type { Order } from "@/types/order"
import type { RefundBreakdown, RefundRequest, RefundRequestStatus } from "@/types/refund"

/**
 * Computes every amount a Finance Admin needs before confirming a refund —
 * always derived fresh from the order + this scope's own refund history +
 * any Finance-entered "refund_adjustment" records (types/finance.ts), never
 * cached. `previouslyRefunded` only counts records that actually reached
 * "Refunded" (money that actually moved); Pending/Approved/Processing/
 * Failed/Rejected records don't reduce what's still eligible. A
 * refund_adjustment is always order-level (never attributed to one
 * seller's partial refund), matching how shipping/discount already work
 * below — so adjustmentAmount is 0 for a seller-scoped breakdown.
 */
export async function computeRefundBreakdown(order: Order, sellerId?: string): Promise<RefundBreakdown> {
  const requests = await listRefundHistory(order.id, sellerId)
  const previouslyRefunded = round2(requests.filter((r) => r.status === "Refunded").reduce((sum, r) => sum + r.amount, 0))

  const adjustmentAmount = sellerId
    ? 0
    : round2(
        (await listApprovedAdjustments({ orderId: order.id, partyType: "buyer", partyId: order.buyerId, type: "refund_adjustment" })).reduce(
          (sum, a) => sum + a.amount,
          0,
        ),
      )

  if (sellerId) {
    const sellerOrder = order.sellerOrders.find((so) => so.sellerId === sellerId)
    if (!sellerOrder) throw new Error("That seller has no items on this order.")
    // Shipping/order-level discount are never attributed to one seller's
    // partial refund — matches the pre-existing whole-vs-seller refund
    // split (see app/api/admin/orders/[id]/refund/route.ts's own doc
    // comment: "Shipping is not refunded on a partial").
    const productAmount = round2(sellerOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
    const eligibleAmount = Math.max(0, round2(productAmount - previouslyRefunded))
    return {
      orderAmount: productAmount,
      productAmount,
      deliveryCharge: 0,
      discount: 0,
      previouslyRefunded,
      eligibleAmount,
      adjustmentAmount: 0,
      finalRefundAmount: eligibleAmount,
    }
  }

  const { subtotal, discount, shipping, total } = order.totals
  const eligibleAmount = Math.max(0, round2(total - previouslyRefunded))
  return {
    orderAmount: total,
    productAmount: subtotal,
    deliveryCharge: shipping,
    discount,
    previouslyRefunded,
    eligibleAmount,
    adjustmentAmount,
    finalRefundAmount: Math.max(0, round2(eligibleAmount - adjustmentAmount)),
  }
}

/** True if a refund for this exact scope is already in flight (Pending/
 * Approved/Processing) — blocks a second concurrent refund attempt on the
 * same order/seller until the first one reaches a terminal state. */
export async function hasInFlightRefund(orderId: string, sellerId?: string): Promise<boolean> {
  const requests = await listRefundHistory(orderId, sellerId)
  return requests.some((r) => r.status === "Pending" || r.status === "Approved" || r.status === "Processing")
}

export async function getRefundHistory(orderId: string): Promise<RefundRequest[]> {
  const snap = await getAdminDb().collection("orders").doc(orderId).collection("refunds").orderBy("createdAt", "desc").get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RefundRequest)
}

interface ApproverInfo {
  uid: string
  email: string
}

/** Marks the affected seller-order(s) Returned and the order Refunded — the
 * exact same terminal write the pre-existing instant-refund flow made —
 * but ONLY when this refund covers the full eligible amount for its scope.
 * A genuine partial/manual refund below the eligible amount never closes
 * out the order; it only records the money movement (totalRefundedAmount),
 * since this codebase has no separate "Partially Refunded" order status to
 * fabricate one. */
async function applyOrderEffectsIfFullyRefunded(
  orderId: string,
  sellerId: string | undefined,
  amount: number,
  breakdown: RefundBreakdown,
): Promise<void> {
  const db = getAdminDb()
  // breakdown.finalRefundAmount (eligible, net of any Finance adjustment) is
  // what was still refundable for this scope BEFORE this refund — covering
  // all of it is what actually leaves nothing further to refund.
  const isFullForScope = amount >= breakdown.finalRefundAmount - 0.005

  await db.runTransaction(async (tx) => {
    const ref = db.collection("orders").doc(orderId)
    const snap = await tx.get(ref)
    if (!snap.exists) return
    const order = snap.data() as Order

    const update: Partial<Order> = {
      totalRefundedAmount: round2((order.totalRefundedAmount ?? 0) + amount),
    }

    if (isFullForScope) {
      update.paymentStatus = "Refunded"
      update.sellerOrders = sellerId
        ? order.sellerOrders.map((so) => (so.sellerId === sellerId ? { ...so, status: "Returned" as const } : so))
        : order.sellerOrders.map((so) => ({ ...so, status: "Returned" as const }))
    }

    tx.update(ref, update)
  })
}

/** Generates the buyer-facing Refund Receipt once a refund has actually
 * reached "Refunded" — never earlier. A document-generation failure never
 * fails the refund itself (the money has already moved); logged instead,
 * same discipline as lib/audit-log.ts's writeAuditLog. */
async function generateRefundReceipt(orderId: string, buyerId: string, refundId: string, amount: number, actor: ApproverInfo): Promise<void> {
  try {
    const { createFinanceDocumentForRefund } = await import("@/lib/finance-documents")
    await createFinanceDocumentForRefund({ id: refundId, orderId, amount }, buyerId, actor)
  } catch (error) {
    console.error("[refund-service] failed to generate refund receipt:", error)
  }
}

async function updateRefundRequest(orderId: string, refundId: string, patch: Partial<RefundRequest>): Promise<void> {
  await getAdminDb()
    .collection("orders")
    .doc(orderId)
    .collection("refunds")
    .doc(refundId)
    .update({ ...patch, updatedAt: new Date().toISOString() })
}

export interface CreateRefundRequestInput {
  order: Order
  sellerId?: string
  mode: "full" | "manual"
  amount?: number
  reason?: string
  approver: ApproverInfo
}

export interface CreateRefundRequestResult {
  refund: RefundRequest
}

/**
 * The one entry point for a Finance Admin issuing a refund — validates the
 * amount against the real eligible amount, requires a reason for a manual
 * amount, writes the record (Pending -> Approved, both happening on this
 * same confirm click), then for a prepaid order calls the real gateway
 * synchronously (Approved -> Processing -> Refunded/Failed) or, for COD,
 * leaves it at Approved as a finance payout/refund record pending manual
 * completion (see decideRefundRequest). Never fabricates a gateway result —
 * a Failed record always carries the gateway's own real message.
 */
export async function createRefundRequest(input: CreateRefundRequestInput): Promise<CreateRefundRequestResult> {
  const { order, sellerId, mode, reason, approver } = input
  const db = getAdminDb()

  if (await hasInFlightRefund(order.id, sellerId)) {
    throw new Error("A refund for this order is already in progress.")
  }

  const breakdown = await computeRefundBreakdown(order, sellerId)
  if (breakdown.finalRefundAmount <= 0) {
    throw new Error("This order has no remaining eligible refund amount.")
  }

  let amount: number
  if (mode === "full") {
    amount = breakdown.finalRefundAmount
  } else {
    if (input.amount === undefined || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Enter a valid refund amount.")
    }
    if (!reason?.trim()) {
      throw new Error("A refund reason is required for a manual refund.")
    }
    amount = round2(input.amount)
    if (amount > breakdown.finalRefundAmount + 0.005) {
      throw new Error(`Refund amount cannot exceed the eligible amount of ${breakdown.finalRefundAmount}.`)
    }
  }

  const now = new Date().toISOString()
  const refundRef = db.collection("orders").doc(order.id).collection("refunds").doc()
  const baseRecord: RefundRequest = {
    id: refundRef.id,
    orderId: order.id,
    ...(sellerId ? { sellerId } : {}),
    mode,
    amount,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    breakdown,
    status: "Approved",
    paymentMethod: order.paymentMethod,
    approvedBy: approver,
    createdAt: now,
    updatedAt: now,
  }
  await refundRef.set(baseRecord)

  if (order.paymentMethod === "cod") {
    // No live gateway to call for cash collected by the courier — this
    // stays a finance-tracked record until a Finance Admin manually
    // confirms the money was actually sent (decideRefundRequest).
    return { refund: baseRecord }
  }

  // Prepaid: process now, synchronously, against the real gateway that
  // actually took this payment — never re-routed by priority (a refund
  // always targets the exact gateway/order/payment that collected the money).
  const gatewayId = order.gatewayId ?? (order.paymentMethod === "razorpay" ? "razorpay" : undefined)
  const gatewayOrderId = order.gatewayOrderId ?? order.razorpayOrderId
  const gatewayPaymentId = order.gatewayPaymentId ?? order.razorpayPaymentId
  if (!gatewayId || !gatewayOrderId || !gatewayPaymentId) {
    const failed: Partial<RefundRequest> = {
      status: "Failed",
      failureReason: "This order has no recorded gateway payment to refund.",
      processedAt: now,
    }
    await updateRefundRequest(order.id, refundRef.id, failed)
    return { refund: { ...baseRecord, ...failed } }
  }

  await updateRefundRequest(order.id, refundRef.id, { status: "Processing" })

  try {
    const result = await refundPaymentForGateway(gatewayId, {
      gatewayOrderId,
      gatewayPaymentId,
      amountPaise: Math.round(amount * 100),
      reason: reason?.trim() || `Order #${order.id.slice(0, 8)} refund`,
    })

    if (!result.ok) {
      const failed: Partial<RefundRequest> = { status: "Failed", failureReason: result.message, processedAt: new Date().toISOString() }
      await updateRefundRequest(order.id, refundRef.id, failed)
      return { refund: { ...baseRecord, status: "Processing", ...failed } }
    }

    const refunded: Partial<RefundRequest> = {
      status: "Refunded",
      processedAt: new Date().toISOString(),
      gatewayId,
      ...(result.gatewayRefundId ? { gatewayRefundId: result.gatewayRefundId } : {}),
    }
    await updateRefundRequest(order.id, refundRef.id, refunded)
    await applyOrderEffectsIfFullyRefunded(order.id, sellerId, amount, breakdown)
    await generateRefundReceipt(order.id, order.buyerId, refundRef.id, amount, approver)
    return { refund: { ...baseRecord, ...refunded } }
  } catch (error) {
    const failed: Partial<RefundRequest> = {
      status: "Failed",
      failureReason: error instanceof Error ? error.message : "The payment gateway rejected this refund.",
      processedAt: new Date().toISOString(),
    }
    await updateRefundRequest(order.id, refundRef.id, failed)
    return { refund: { ...baseRecord, status: "Processing", ...failed } }
  }
}

/**
 * Finance Admin's manual completion of a COD refund record that has no
 * live gateway to confirm it — "Refunded" here means they've verified the
 * money actually left the business (bank transfer/UPI, outside this
 * system); "Failed"/"Rejected" record that it didn't/won't happen. Only
 * ever valid on a record still sitting at "Approved".
 */
export async function decideRefundRequest(
  orderId: string,
  refundId: string,
  decision: "Refunded" | "Failed" | "Rejected",
  note: string | undefined,
  actor: ApproverInfo,
): Promise<RefundRequest> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId).collection("refunds").doc(refundId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error("Refund record not found.")
  const record = snap.data() as RefundRequest

  if (record.status !== "Approved") {
    throw new Error(`Cannot mark a refund "${decision}" from status "${record.status}".`)
  }

  const patch: Partial<RefundRequest> = {
    status: decision,
    processedAt: new Date().toISOString(),
    ...(decision === "Failed" && note?.trim() ? { failureReason: note.trim() } : {}),
  }
  await ref.update({ ...patch, updatedAt: new Date().toISOString() })

  if (decision === "Refunded") {
    await applyOrderEffectsIfFullyRefunded(orderId, record.sellerId, record.amount, record.breakdown)
    const orderSnap = await db.collection("orders").doc(orderId).get()
    const buyerId = (orderSnap.data() as Order | undefined)?.buyerId
    if (buyerId) await generateRefundReceipt(orderId, buyerId, refundId, record.amount, actor)
  }

  return { ...record, ...patch }
}

export type { RefundRequestStatus }
