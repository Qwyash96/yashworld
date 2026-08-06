"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Undo2 } from "lucide-react"
import { fetchRefundableOrders, refundOrder } from "@/lib/admin-orders-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { formatPrice } from "@/lib/products"
import type { Order, PaymentMethod } from "@/types/order"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Admin-facing only — mirrors each adapter's own `name` in
// lib/integrations/registry.ts (server-only, can't import that here).
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
  cashfree: "Cashfree",
  phonepe: "PhonePe PG",
  payu: "PayU",
  stripe: "Stripe",
  paypal: "PayPal",
}

export default function AdminRefundsPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Refunded">("Paid")
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchRefundableOrders({ paymentStatus, cursor })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setOrders(result.orders)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => {
    setCursorStack([null])
    setPageIndex(0)
    loadPage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus])

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

  async function handleRefund(orderId: string) {
    if (!window.confirm("Refund the entire order?")) return
    setBusyId(orderId)
    const result = await refundOrder(orderId)
    setBusyId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Refund issued.")
    loadPage(cursorStack[pageIndex])
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Undo2 className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Refunds</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Paid orders eligible for refund, and refund history.</p>

      <div className="mt-6 flex items-center gap-2">
        <Select value={paymentStatus} onValueChange={(v) => v && setPaymentStatus(v as "Paid" | "Refunded")}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Paid">Paid (refundable)</SelectItem>
            <SelectItem value="Refunded">Already refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && orders === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : orders && orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No orders here.</p>
        ) : (
          <div className="divide-y divide-border">
            {orders?.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span className="font-semibold text-black">#{order.id.slice(0, 8)}</span>
                  <p className="text-xs text-[#888888]">
                    {order.contactEmail} · {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="font-semibold text-black">{formatPrice(order.totals.total)}</span>
                <Badge variant={order.paymentStatus === "Refunded" ? "destructive" : "default"}>{order.paymentStatus}</Badge>
                <span className="text-xs text-[#888888]">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                {order.paymentStatus === "Paid" && (
                  <Button size="sm" variant="destructive" className="h-8" disabled={busyId === order.id} onClick={() => handleRefund(order.id)}>
                    Refund
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
