"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Wallet } from "lucide-react"
import { fetchPayouts } from "@/lib/admin-payouts-client"
import { approveWithdrawal, rejectWithdrawal, markWithdrawalPaid } from "@/lib/admin-seller-wallet-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { formatPrice } from "@/lib/products"
import type { PayoutRow, WithdrawalRequestStatus } from "@/types/wallet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_VARIANT: Record<WithdrawalRequestStatus, "default" | "secondary" | "outline" | "destructive"> = {
  requested: "outline",
  approved: "secondary",
  paid: "default",
  rejected: "destructive",
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null)
  const [status, setStatus] = useState<WithdrawalRequestStatus | "">("requested")
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchPayouts({ status: status || undefined, cursor })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setPayouts(result.payouts)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => {
    setCursorStack([null])
    setPageIndex(0)
    loadPage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function handleNext() {
    if (!hasMore || !nextCursor) return
    const newStack = [...cursorStack.slice(0, pageIndex + 1), nextCursor]
    setCursorStack(newStack)
    setPageIndex(pageIndex + 1)
    loadPage(nextCursor)
  }

  function handlePrevious() {
    if (pageIndex === 0) return
    setPageIndex(pageIndex - 1)
    loadPage(cursorStack[pageIndex - 1])
  }

  async function handleAction(action: "approve" | "reject" | "mark-paid", id: string) {
    setBusyId(id)
    const fn = action === "approve" ? approveWithdrawal : action === "reject" ? rejectWithdrawal : markWithdrawalPaid
    const result = await fn(id)
    setBusyId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Payout ${action === "mark-paid" ? "marked paid" : action + "d"}.`)
    loadPage(cursorStack[pageIndex])
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Wallet className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Payouts</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Seller withdrawal requests, across every seller.</p>

      <div className="mt-6 flex items-center gap-2">
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v as WithdrawalRequestStatus))}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && payouts === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : payouts && payouts.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No payouts here.</p>
        ) : (
          <div className="divide-y divide-border">
            {payouts?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-semibold text-black">
                    {p.settlementNumber} · {p.sellerShopName}
                  </p>
                  <p className="text-xs text-[#888888]">Requested {new Date(p.requestedAt).toLocaleString()}</p>
                </div>
                <span className="font-semibold text-black">{formatPrice(p.amount)}</span>
                <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                {p.status === "requested" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8" disabled={busyId === p.id} onClick={() => handleAction("approve", p.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={busyId === p.id} onClick={() => handleAction("reject", p.id)}>
                      Reject
                    </Button>
                  </div>
                )}
                {p.status === "approved" && (
                  <Button size="sm" className="h-8" disabled={busyId === p.id} onClick={() => handleAction("mark-paid", p.id)}>
                    Mark Paid
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PaginationControls
        onPrevious={handlePrevious}
        onNext={handleNext}
        canGoPrevious={pageIndex > 0}
        canGoNext={hasMore}
        loading={loading}
      />
    </div>
  )
}
