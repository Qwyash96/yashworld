"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Truck, RefreshCw, PackageCheck } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getOrdersBySeller, updateSellerOrderStatus, syncSellerOrderTracking } from "@/services/order.service"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import type { Order, OrderStatus } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterKey = "shippable" | "Packed" | "Pickup Requested" | "In Transit" | "Delivered"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "shippable", label: "All Shipments" },
  { key: "Packed", label: "Ready to Ship" },
  { key: "Pickup Requested", label: "Pickup Requested" },
  { key: "In Transit", label: "In Transit" },
  { key: "Delivered", label: "Delivered" },
]

// Only statuses relevant to shipping — pre-pack orders (Pending/Accepted/Ready
// To Pack) live on the Order Fulfillment dashboard, not here.
const SHIPPABLE_STATUSES = new Set<OrderStatus>(["Packed", "Pickup Requested", "Picked Up", "In Transit", "Out For Delivery", "Delivered"])

function matchesFilter(status: OrderStatus, filter: FilterKey): boolean {
  if (filter === "shippable") return SHIPPABLE_STATUSES.has(status)
  if (filter === "In Transit") return status === "Picked Up" || status === "In Transit" || status === "Out For Delivery"
  return status === filter
}

export default function SellerShippingDashboardPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [filter, setFilter] = useState<FilterKey>("shippable")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [autoAwbEnabled, setAutoAwbEnabled] = useState(false)
  const [bulkCourier, setBulkCourier] = useState("")
  const [busy, setBusy] = useState(false)

  function refresh() {
    if (!sellerUid) return
    getOrdersBySeller(sellerUid).then(setOrders)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerUid])

  useEffect(() => {
    fetch("/api/seller/shipping/config")
      .then((r) => r.json())
      .then((body) => setAutoAwbEnabled(!!body.autoAwbEnabled))
      .catch(() => setAutoAwbEnabled(false))
  }, [])

  const rows = useMemo(() => {
    if (!orders || !sellerUid) return []
    return orders
      .map((order) => ({ order, mine: order.sellerOrders.find((so) => so.sellerId === sellerUid) }))
      .filter((r): r is { order: Order; mine: NonNullable<typeof r.mine> } => !!r.mine && SHIPPABLE_STATUSES.has(r.mine.status))
  }, [orders, sellerUid])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ order, mine }) => {
      if (!matchesFilter(mine.status, filter)) return false
      if (q) {
        const idMatch = order.id.toLowerCase().includes(q)
        const nameMatch = order.shippingAddress.fullName.toLowerCase().includes(q)
        const trackingMatch = mine.trackingNumber?.toLowerCase().includes(q)
        if (!idMatch && !nameMatch && !trackingMatch) return false
      }
      return true
    })
  }, [rows, filter, search])

  const selectedRows = useMemo(() => filtered.filter((r) => selected.has(r.order.id)), [filtered, selected])
  const canBulkPickup = selectedRows.length > 0 && selectedRows.every((r) => r.mine.status === "Packed")
  const canBulkSync = selectedRows.length > 0 && selectedRows.every((r) => r.mine.shippingProvider === "shiprocket")

  function toggleSelected(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.order.id))))
  }

  async function handleBulkSchedulePickup() {
    if (!autoAwbEnabled && !bulkCourier.trim()) {
      toast.error("Enter a courier partner for this batch.")
      return
    }
    setBusy(true)
    const results = await Promise.allSettled(
      selectedRows.map(({ order }) =>
        updateSellerOrderStatus(order.id, sellerUid!, {
          status: "Pickup Requested",
          ...(autoAwbEnabled ? {} : { courierPartner: bulkCourier.trim() }),
        }),
      ),
    )
    setBusy(false)
    const failed = results.filter((r) => r.status === "rejected").length
    toast[failed ? "error" : "success"](
      failed ? `${results.length - failed} scheduled, ${failed} failed.` : `Pickup scheduled for ${results.length} order(s).`,
    )
    setSelected(new Set())
    setBulkCourier("")
    refresh()
  }

  async function handleBulkSync() {
    setBusy(true)
    const results = await Promise.allSettled(selectedRows.map(({ order }) => syncSellerOrderTracking(order.id)))
    setBusy(false)
    const failed = results.filter((r) => r.status === "rejected").length
    const changed = results.filter((r) => r.status === "fulfilled" && r.value.changed).length
    toast[failed ? "error" : "success"](
      failed ? `${results.length - failed} synced, ${failed} failed.` : `Synced ${results.length} shipment(s) — ${changed} updated.`,
    )
    setSelected(new Set())
    refresh()
  }

  if (gate.state === "loading") {
    return <div className="mx-auto max-w-6xl px-4 py-16">Loading...</div>
  }
  if (gate.state === "signed-out") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="mb-4">Sign in to access the seller dashboard.</p>
        <Link href="/login" className="text-green-700 underline underline-offset-4">
          Sign in
        </Link>
      </div>
    )
  }
  if (gate.state !== "approved") {
    return <div className="mx-auto max-w-6xl px-4 py-16">Your seller application is pending admin approval.</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-black">
            <Truck className="size-6 text-green-700" />
            Shipping Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#444444]">
            Every in-flight shipment across your orders, in one place.{" "}
            <Link href="/seller/orders" className="text-green-700 underline underline-offset-4">
              Full Order Fulfillment
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key)
              setSelected(new Set())
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              filter === f.key ? "bg-green-600 text-white" : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by order id, buyer name, or AWB..."
        className="mt-4 h-10 max-w-sm"
      />

      {selectedRows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-green-600/30 bg-green-50 p-4">
          <span className="text-sm font-medium text-green-800">{selectedRows.length} selected</span>
          {canBulkPickup && (
            <>
              {!autoAwbEnabled && (
                <Input
                  value={bulkCourier}
                  onChange={(e) => setBulkCourier(e.target.value)}
                  placeholder="Courier partner for this batch"
                  className="h-9 w-56"
                />
              )}
              <Button size="sm" className="h-9" onClick={handleBulkSchedulePickup} disabled={busy}>
                <PackageCheck className="size-3.5" />
                Schedule Pickup ({selectedRows.length})
              </Button>
            </>
          )}
          {canBulkSync && (
            <Button size="sm" variant="outline" className="h-9" onClick={handleBulkSync} disabled={busy}>
              <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
              Sync Tracking ({selectedRows.length})
            </Button>
          )}
          {!canBulkPickup && !canBulkSync && (
            <span className="text-xs text-green-800">Select shipments in the same stage to enable bulk actions.</span>
          )}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-[#444444]">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} />
              </th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Courier</th>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Pickup</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#444444]">
                  No shipments in this view.
                </td>
              </tr>
            )}
            {filtered.map(({ order, mine }) => (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-[#f9faf8]">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelected(order.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/seller/orders/${order.id}`} className="font-medium text-green-700 hover:underline">
                    #{order.id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-[#888888]">{mine.items.length} item(s)</p>
                </td>
                <td className="px-4 py-3 text-[#444444]">
                  {order.shippingAddress.city}, {order.shippingAddress.state}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={mine.status} />
                </td>
                <td className="px-4 py-3 text-[#444444]">{mine.courierPartner ?? "—"}</td>
                <td className="px-4 py-3 text-[#444444]">{mine.trackingNumber ?? "—"}</td>
                <td className="px-4 py-3 text-[#444444]">{mine.pickupDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
