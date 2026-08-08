"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Banknote, AlertTriangle } from "lucide-react"
import { fetchSettlements } from "@/lib/admin-settlements-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { formatPrice } from "@/lib/products"
import { orderDisplayId } from "@/lib/order-display"
import type { Order } from "@/types/order"

export default function AdminSettlementsPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [totalCaptured, setTotalCaptured] = useState(0)
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchSettlements(cursor)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setOrders(result.orders)
    setTotalCaptured(result.totalCaptured)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => {
    loadPage(null)
  }, [])

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

  return (
    <div>
      <div className="flex items-center gap-3">
        <Banknote className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Settlements</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every payment captured across all payment gateways, this page.</p>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          This shows real captured-payment records from orders — not any gateway&apos;s own bank-settlement report
          (UTR numbers, settlement batch dates). That requires a separate call to each gateway&apos;s own Settlements
          API, which isn&apos;t wired up yet.
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">Captured This Page</p>
        <p className="mt-1 text-2xl font-bold text-black">{formatPrice(totalCaptured)}</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && orders === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : orders && orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No captured payments yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {orders?.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span className="font-semibold text-black">#{orderDisplayId(order)}</span>
                  <p className="text-xs text-[#888888]">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <span className="font-mono text-xs text-[#888888]">
                  {order.gatewayId ? `${order.gatewayId}: ` : ""}
                  {order.gatewayPaymentId ?? order.razorpayPaymentId ?? "—"}
                </span>
                <span className="font-semibold text-black">{formatPrice(order.totals.total)}</span>
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
