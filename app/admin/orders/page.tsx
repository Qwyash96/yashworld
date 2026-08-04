"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ClipboardList, Search } from "lucide-react"
import { fetchOrders } from "@/lib/admin-orders-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { formatPrice } from "@/lib/products"
import type { Order, OrderStatus, PaymentStatus } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_OPTIONS: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Ready To Pack",
  "Packed",
  "Pickup Requested",
  "Picked Up",
  "In Transit",
  "Out For Delivery",
  "Delivered",
  "Returned",
  "Cancelled",
]

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ["Pending", "Paid", "Failed", "Refunded"]

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all")
  const [paymentFilter, setPaymentFilter] = useState<string>(searchParams.get("paymentStatus") ?? "all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchOrders({
      status: statusFilter === "all" ? undefined : statusFilter,
      paymentStatus: paymentFilter === "all" ? undefined : paymentFilter,
      search: search || undefined,
      cursor,
    })
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
  }, [statusFilter, paymentFilter, search])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim().toLowerCase())
  }

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
        <ClipboardList className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Orders</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every order placed on the platform.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by buyer email prefix..."
            className="h-9 w-64"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9">
            <Search className="size-3.5" />
            Search
          </Button>
        </form>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => v && setPaymentFilter(v)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Statuses</SelectItem>
            {PAYMENT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
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
          <p className="p-8 text-center text-sm text-[#444444]">No orders match this search/filter.</p>
        ) : (
          <div className="divide-y divide-border">
            {orders?.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-green-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-black">Order #{order.id.slice(0, 8)}</p>
                  <p className="truncate text-sm text-[#444444]">{order.contactEmail}</p>
                  <p className="text-xs text-[#444444]">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-black">{formatPrice(order.totals.total)}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </Link>
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
