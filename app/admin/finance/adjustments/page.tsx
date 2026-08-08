"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Landmark, Eye, Download, Printer } from "lucide-react"
import {
  fetchAdjustments,
  createAdjustment,
  decideAdjustment,
  fetchAdjustmentDetail,
  type ListAdjustmentsParams,
} from "@/lib/admin-finance-client"
import { fetchBusinessInfo, type AdjustmentDocumentContext } from "@/lib/documents/finance-document-context"
import { buildAdjustmentStatementPdf } from "@/lib/documents/adjustment-statement"
import { downloadPdf, viewPdf, printPdf } from "@/lib/documents/pdf-actions"
import { formatPrice } from "@/lib/products"
import type { FinanceAdjustment, AdjustmentParty, AdjustmentType, AdjustmentStatus } from "@/types/finance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const STATUS_BADGE: Record<AdjustmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "outline",
  Approved: "default",
  Rejected: "destructive",
}

const TYPE_LABEL: Record<AdjustmentType, string> = {
  charge: "Charge",
  credit: "Credit",
  refund_adjustment: "Refund Adjustment",
}

export default function AdminFinanceAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<FinanceAdjustment[] | null>(null)
  const [filters, setFilters] = useState<ListAdjustmentsParams>({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  function refresh() {
    setLoading(true)
    fetchAdjustments(filters).then((result) => {
      setLoading(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAdjustments(result.adjustments)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function handleDecision(id: string, decision: "Approved" | "Rejected") {
    if (!window.confirm(`${decision === "Approved" ? "Approve" : "Reject"} this adjustment?`)) return
    setBusyId(id)
    const result = await decideAdjustment(id, decision)
    setBusyId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Adjustment ${decision.toLowerCase()}.`)
    refresh()
  }

  async function handleDocumentAction(adjustmentId: string, action: "view" | "download" | "print") {
    const detail = await fetchAdjustmentDetail(adjustmentId)
    if (!detail.ok) {
      toast.error(detail.error)
      return
    }
    if (!detail.document) {
      toast.error("No document has been generated for this adjustment yet.")
      return
    }
    const business = await fetchBusinessInfo()
    const adjustment = detail.adjustment
    const ctx: AdjustmentDocumentContext = {
      business,
      documentNumber: detail.document.documentNumber,
      documentTypeLabel: adjustment.type === "credit" ? "Credit / Adjustment Statement" : "Debit / Adjustment Statement",
      createdAt: detail.document.createdAt,
      orderId: adjustment.orderId,
      partyLabel: adjustment.partyType === "seller" ? `Seller ${adjustment.partyId}` : "Buyer",
      type: adjustment.type,
      amount: adjustment.amount,
      reason: adjustment.reason,
      notes: adjustment.notes,
      previousBalance: adjustment.previousBalance,
      newBalance: adjustment.newBalance,
      createdByEmail: adjustment.createdBy.email,
      approvedByEmail: adjustment.approvedBy?.email,
      approvedAt: adjustment.approvedAt,
      status: adjustment.status,
    }
    const doc = buildAdjustmentStatementPdf(ctx)
    if (action === "view") viewPdf(doc)
    else if (action === "print") printPdf(doc)
    else downloadPdf(doc, `${ctx.documentNumber}.pdf`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Landmark className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Finance Adjustments</h1>
        </div>
        <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
          New Adjustment
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Charge, Credit, and Refund Adjustment records — create, approve/reject, and view documents.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? undefined : (v as AdjustmentType) }))}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="charge">Charge</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="refund_adjustment">Refund Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : (v as AdjustmentStatus) }))}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.partyType ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, partyType: v === "all" ? undefined : (v as AdjustmentParty) }))}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All Parties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Parties</SelectItem>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="seller">Seller</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {loading && adjustments === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : adjustments && adjustments.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No adjustments yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {adjustments?.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-black">
                      {TYPE_LABEL[a.type]} · {formatPrice(a.amount)}
                    </span>
                    <p className="text-xs text-[#888888]">
                      {a.partyType === "seller" ? `Seller ${a.partyId}` : "Buyer"}
                      {a.orderId ? ` · Order #${a.orderId.slice(0, 8)}` : ""} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[a.status]}>{a.status}</Badge>
                </div>
                <p className="text-xs text-[#444444]">Reason: {a.reason}</p>
                {a.notes && <p className="text-xs text-[#888888]">Notes: {a.notes}</p>}
                <p className="text-xs text-[#888888]">
                  Previous: {formatPrice(a.previousBalance)} → New: {formatPrice(a.newBalance)}
                </p>
                <p className="text-xs text-[#888888]">
                  Created by {a.createdBy.email}
                  {a.approvedBy ? ` · Approved by ${a.approvedBy.email} on ${new Date(a.approvedAt!).toLocaleString()}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {a.status === "Pending" && (
                    <>
                      <Button size="sm" className="h-8" disabled={busyId === a.id} onClick={() => handleDecision(a.id, "Approved")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-red-600" disabled={busyId === a.id} onClick={() => handleDecision(a.id, "Rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {a.status === "Approved" && a.relatedDocumentId && (
                    <>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleDocumentAction(a.id, "view")}>
                        <Eye className="size-3.5" />
                        View Document
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleDocumentAction(a.id, "download")}>
                        <Download className="size-3.5" />
                        Download PDF
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleDocumentAction(a.id, "print")}>
                        <Printer className="size-3.5" />
                        Print
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewAdjustmentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  )
}

function NewAdjustmentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [type, setType] = useState<AdjustmentType>("charge")
  const [orderId, setOrderId] = useState("")
  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)

  const partyType: AdjustmentParty = type === "refund_adjustment" ? "buyer" : "seller"

  function reset() {
    setType("charge")
    setOrderId("")
    setPartyId("")
    setAmount("")
    setReason("")
    setNotes("")
  }

  async function handleSubmit() {
    const amountNumber = Number(amount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Enter a valid positive amount.")
      return
    }
    if (!partyId.trim()) {
      toast.error(`${partyType === "seller" ? "Seller" : "Buyer"} ID is required.`)
      return
    }
    if (type === "refund_adjustment" && !orderId.trim()) {
      toast.error("Order ID is required for a refund adjustment.")
      return
    }
    if (!reason.trim()) {
      toast.error("A reason is required.")
      return
    }

    setBusy(true)
    const result = await createAdjustment({
      type,
      partyType,
      partyId: partyId.trim(),
      orderId: orderId.trim() || undefined,
      amount: amountNumber,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Adjustment created — pending approval.")
    reset()
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New Finance Adjustment</DialogTitle>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as AdjustmentType)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="charge">Charge (Seller)</SelectItem>
                <SelectItem value="credit">Credit (Seller)</SelectItem>
                <SelectItem value="refund_adjustment">Refund Adjustment (Buyer)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-party">{partyType === "seller" ? "Seller ID" : "Buyer ID"}</Label>
            <Input id="adj-party" value={partyId} onChange={(e) => setPartyId(e.target.value)} className="h-10" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-order">Order ID {type === "refund_adjustment" ? "(required)" : "(optional)"}</Label>
            <Input id="adj-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="h-10" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-amount">Amount (positive value only)</Label>
            <Input id="adj-amount" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-reason">Reason (required)</Label>
            <textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-20 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primary"
              placeholder="e.g. Damage handling charge, Approved compensation, ..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-notes">Notes (optional)</Label>
            <textarea
              id="adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-16 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <Button className="h-10" onClick={handleSubmit} disabled={busy}>
            Create Adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
