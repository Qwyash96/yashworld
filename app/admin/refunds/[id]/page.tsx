"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Undo2 } from "lucide-react"
import { fetchRefundDetail, submitRefund, decideRefund, type RefundDetail } from "@/lib/admin-orders-client"
import { fetchLedger, fetchFinanceDocuments, fetchFinanceDocumentDetail, type LedgerEntry } from "@/lib/admin-finance-client"
import type { RefundDocumentContext } from "@/lib/documents/finance-document-context"
import { buildRefundReceiptPdf } from "@/lib/documents/refund-receipt"
import { downloadPdf, viewPdf, printPdf } from "@/lib/documents/pdf-actions"
import { formatPrice } from "@/lib/products"
import type { PaymentMethod } from "@/types/order"
import type { RefundBreakdown } from "@/types/refund"
import type { FinanceDocument } from "@/types/finance-document"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Download, Printer } from "lucide-react"

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
  cashfree: "Cashfree",
  phonepe: "PhonePe PG",
  payu: "PayU",
  stripe: "Stripe",
  paypal: "PayPal",
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "outline",
  Approved: "secondary",
  Processing: "secondary",
  Refunded: "default",
  Failed: "destructive",
  Rejected: "destructive",
}

const WHOLE_ORDER = "__order__"

export default function AdminRefundDetailPage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<RefundDetail | null | undefined>(undefined)
  const [scope, setScope] = useState<string>(WHOLE_ORDER)
  const [mode, setMode] = useState<"full" | "manual">("full")
  const [manualAmount, setManualAmount] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null)
  const [ledger, setLedger] = useState<{ entries: LedgerEntry[]; netTotal: number } | null>(null)
  const [documents, setDocuments] = useState<FinanceDocument[]>([])
  const [docBusyId, setDocBusyId] = useState<string | null>(null)

  function refresh() {
    fetchRefundDetail(params.id).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        setDetail(null)
        return
      }
      setDetail(result.data)
    })
    fetchLedger(params.id).then((result) => {
      if (result.ok) setLedger({ entries: result.entries, netTotal: result.netTotal })
    })
    fetchFinanceDocuments({ orderId: params.id }).then((result) => {
      if (result.ok) setDocuments(result.documents)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const breakdown: RefundBreakdown | undefined = useMemo(() => {
    if (!detail) return undefined
    if (scope === WHOLE_ORDER) return detail.scopes.order
    return detail.scopes.sellers.find((s) => s.sellerId === scope)?.breakdown
  }, [detail, scope])

  const scopeRefunds = useMemo(() => {
    if (!detail) return []
    return detail.refunds.filter((r) => (scope === WHOLE_ORDER ? !r.sellerId : r.sellerId === scope))
  }, [detail, scope])

  const inFlight = scopeRefunds.some((r) => r.status === "Pending" || r.status === "Approved" || r.status === "Processing")

  if (detail === undefined) return <div className="p-8 text-sm text-[#444444]">Loading...</div>
  if (detail === null) {
    return (
      <div className="p-8 text-center">
        <p className="text-black">Order not found.</p>
        <Link href="/admin/refunds" className="mt-4 inline-block text-green-700 hover:underline">
          Back to Return/Refund
        </Link>
      </div>
    )
  }

  async function handleFullRefund() {
    if (!breakdown || breakdown.finalRefundAmount <= 0) return
    if (!window.confirm(`Issue a full refund of ${formatPrice(breakdown.finalRefundAmount)}?`)) return
    setBusy(true)
    const result = await submitRefund(params.id, { mode: "full", sellerId: scope === WHOLE_ORDER ? undefined : scope })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(result.refund.status === "Refunded" ? "Refund issued." : `Refund ${result.refund.status.toLowerCase()}.`)
    refresh()
  }

  async function handleManualRefund() {
    if (!breakdown) return
    const amount = Number(manualAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount.")
      return
    }
    if (amount > breakdown.finalRefundAmount) {
      toast.error(`Amount cannot exceed the eligible refund amount of ${formatPrice(breakdown.finalRefundAmount)}.`)
      return
    }
    if (!reason.trim()) {
      toast.error("A refund reason is required.")
      return
    }
    if (!window.confirm(`Issue a manual refund of ${formatPrice(amount)}?`)) return
    setBusy(true)
    const result = await submitRefund(params.id, {
      mode: "manual",
      amount,
      reason: reason.trim(),
      sellerId: scope === WHOLE_ORDER ? undefined : scope,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(result.refund.status === "Refunded" ? "Refund issued." : `Refund ${result.refund.status.toLowerCase()}.`)
    setManualAmount("")
    setReason("")
    refresh()
  }

  async function handleRefundDocumentAction(refundId: string, action: "view" | "download" | "print") {
    const document = documents.find((d) => d.relatedRefundId === refundId)
    if (!document) {
      toast.error("No document has been generated for this refund yet.")
      return
    }
    setDocBusyId(refundId)
    const result = await fetchFinanceDocumentDetail<RefundDocumentContext>(document.id)
    setDocBusyId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const doc = buildRefundReceiptPdf(result.context)
    if (action === "view") viewPdf(doc)
    else if (action === "print") printPdf(doc)
    else downloadPdf(doc, `${result.context.documentNumber}.pdf`)
  }

  async function handleDecision(refundId: string, decision: "Refunded" | "Failed" | "Rejected") {
    const note = decision === "Failed" ? (window.prompt("Reason (optional)?") ?? undefined) : undefined
    if (!window.confirm(`Mark this refund as ${decision}?`)) return
    setDecisionBusyId(refundId)
    const result = await decideRefund(params.id, refundId, decision, note)
    setDecisionBusyId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Refund marked ${decision}.`)
    refresh()
  }

  return (
    <div>
      <Link href="/admin/refunds" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Return/Refund
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Undo2 className="size-6 text-green-700" />
          <div>
            <h1 className="text-2xl font-bold text-black">Order #{detail.order.id.slice(0, 8)}</h1>
            <p className="text-sm text-[#444444]">
              {detail.order.contactEmail} · {new Date(detail.order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <Badge variant={detail.order.paymentStatus === "Refunded" ? "destructive" : "default"}>{detail.order.paymentStatus}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Scope + breakdown */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Refund Scope</h2>
              {detail.order.sellerOrders.length > 1 && (
                <Select value={scope} onValueChange={(v) => v && setScope(v)}>
                  <SelectTrigger className="h-9 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WHOLE_ORDER}>Whole order</SelectItem>
                    {detail.order.sellerOrders.map((so) => (
                      <SelectItem key={so.sellerId} value={so.sellerId}>
                        Seller {so.sellerId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {breakdown && (
              <div className="mt-4 flex flex-col gap-1.5 text-sm">
                <Row label="Original Order Amount" value={formatPrice(breakdown.orderAmount)} />
                <Row label="Product Amount" value={formatPrice(breakdown.productAmount)} />
                <Row label="Delivery Charge" value={formatPrice(breakdown.deliveryCharge)} />
                <Row label="Discount" value={`-${formatPrice(breakdown.discount)}`} />
                <Row label="Previously Refunded" value={formatPrice(breakdown.previouslyRefunded)} />
                <div className="mt-1 border-t border-border pt-1.5">
                  <Row label="Eligible Refund" value={formatPrice(breakdown.eligibleAmount)} bold />
                </div>
                {breakdown.adjustmentAmount > 0 && (
                  <>
                    <Row label="Finance Adjustment" value={`-${formatPrice(breakdown.adjustmentAmount)}`} />
                    <div className="mt-1 border-t border-border pt-1.5">
                      <Row label="Final Refund" value={formatPrice(breakdown.finalRefundAmount)} bold />
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-[#888888]">
              Payment: {PAYMENT_METHOD_LABELS[detail.order.paymentMethod] ?? detail.order.paymentMethod}
            </p>
          </div>

          {/* Refund actions */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Issue Refund</h2>

            {!breakdown || breakdown.finalRefundAmount <= 0 ? (
              <p className="mt-3 text-sm text-[#444444]">No remaining eligible refund amount for this scope.</p>
            ) : inFlight ? (
              <p className="mt-3 text-sm text-amber-700">A refund for this scope is already in progress — see history below.</p>
            ) : (
              <>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant={mode === "full" ? "default" : "outline"} className="h-8" onClick={() => setMode("full")}>
                    Full Refund
                  </Button>
                  <Button size="sm" variant={mode === "manual" ? "default" : "outline"} className="h-8" onClick={() => setMode("manual")}>
                    Manual Refund
                  </Button>
                </div>

                {mode === "full" ? (
                  <div className="mt-4">
                    <p className="text-sm text-[#444444]">
                      Refund the full eligible amount of <span className="font-semibold text-black">{formatPrice(breakdown.finalRefundAmount)}</span>.
                    </p>
                    <Button className="mt-3 h-10" variant="destructive" onClick={handleFullRefund} disabled={busy}>
                      Confirm Full Refund
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="refund-amount">Refund Amount</Label>
                      <Input
                        id="refund-amount"
                        type="number"
                        min={0}
                        max={breakdown.finalRefundAmount}
                        step="0.01"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder={`Up to ${formatPrice(breakdown.finalRefundAmount)}`}
                        className="h-10"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="refund-reason">Refund Reason</Label>
                      <textarea
                        id="refund-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="h-24 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primary"
                        placeholder="Required — e.g. partial goodwill adjustment, damaged item, ..."
                      />
                    </div>
                    <Button className="h-10 w-fit" variant="destructive" onClick={handleManualRefund} disabled={busy}>
                      Confirm Manual Refund
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Refund History</h2>
            {scopeRefunds.length === 0 ? (
              <p className="mt-3 text-sm text-[#444444]">No refunds yet for this scope.</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-border">
                {scopeRefunds.map((r) => (
                  <div key={r.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-black">
                        {formatPrice(r.amount)} · {r.mode === "full" ? "Full" : "Manual"}
                      </span>
                      <Badge variant={STATUS_BADGE[r.status] ?? "outline"}>{r.status}</Badge>
                    </div>
                    {r.reason && <p className="text-xs text-[#444444]">Reason: {r.reason}</p>}
                    {r.failureReason && <p className="text-xs text-red-600">Failure: {r.failureReason}</p>}
                    <p className="text-xs text-[#888888]">
                      Approved by {r.approvedBy.email} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                    {r.processedAt && <p className="text-xs text-[#888888]">Processed {new Date(r.processedAt).toLocaleString()}</p>}
                    {r.gatewayRefundId && <p className="text-xs text-[#888888]">Gateway Refund ID: {r.gatewayRefundId}</p>}
                    {r.status === "Approved" && detail.order.paymentMethod === "cod" && (
                      <div className="mt-1 flex gap-2">
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={decisionBusyId === r.id}
                          onClick={() => handleDecision(r.id, "Refunded")}
                        >
                          Mark Refunded
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={decisionBusyId === r.id}
                          onClick={() => handleDecision(r.id, "Failed")}
                        >
                          Mark Failed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-red-600"
                          disabled={decisionBusyId === r.id}
                          onClick={() => handleDecision(r.id, "Rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {r.status === "Refunded" && documents.some((d) => d.relatedRefundId === r.id) && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="h-8" disabled={docBusyId === r.id} onClick={() => handleRefundDocumentAction(r.id, "view")}>
                          <Eye className="size-3.5" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" disabled={docBusyId === r.id} onClick={() => handleRefundDocumentAction(r.id, "download")}>
                          <Download className="size-3.5" />
                          Download
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" disabled={docBusyId === r.id} onClick={() => handleRefundDocumentAction(r.id, "print")}>
                          <Printer className="size-3.5" />
                          Print
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ledger */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Transaction Ledger</h2>
            {!ledger || ledger.entries.length === 0 ? (
              <p className="mt-3 text-sm text-[#444444]">No ledger entries yet.</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-border text-sm">
                {ledger.entries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="text-black">{entry.label}</p>
                      <p className="text-xs text-[#888888]">
                        {new Date(entry.at).toLocaleString()}
                        {entry.documentNumber ? ` · ${entry.documentNumber}` : ""}
                      </p>
                    </div>
                    <span className={entry.amount >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                      {entry.amount >= 0 ? "+" : "-"}
                      {formatPrice(Math.abs(entry.amount))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="font-semibold text-black">Net Total</span>
                  <span className="font-semibold text-black">{formatPrice(ledger.netTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Order Total</h2>
            <div className="mt-3 flex flex-col gap-1.5 text-sm">
              <Row label="Subtotal" value={formatPrice(detail.order.totals.subtotal)} />
              <Row label="Discount" value={`-${formatPrice(detail.order.totals.discount)}`} />
              <Row label="Shipping" value={formatPrice(detail.order.totals.shipping)} />
              <div className="mt-1 border-t border-border pt-1.5">
                <Row label="Total" value={formatPrice(detail.order.totals.total)} bold />
              </div>
              <div className="mt-1 border-t border-border pt-1.5">
                <Row label="Total Refunded" value={formatPrice(detail.order.totalRefundedAmount)} bold />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#444444]">{label}</span>
      <span className={bold ? "font-semibold text-black" : "text-black"}>{value}</span>
    </div>
  )
}
