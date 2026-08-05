"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Search, Wallet as WalletIcon, PackageSearch } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { getOrdersBySeller } from "@/services/order.service"
import { fetchMyWallet, requestWithdrawal } from "@/lib/seller-wallet-client"
import { formatPrice } from "@/lib/products"
import type { Order, OrderStatus } from "@/types/order"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterKey = "all" | "Pending" | "Accepted" | "Packed" | "Pickup Pending" | "Shipped" | "Delivered" | "Returned" | "Cancelled"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Accepted", label: "Accepted" },
  { key: "Packed", label: "Packed" },
  { key: "Pickup Pending", label: "Pickup Pending" },
  { key: "Shipped", label: "Shipped" },
  { key: "Delivered", label: "Delivered" },
  { key: "Returned", label: "Returned" },
  { key: "Cancelled", label: "Cancelled" },
]

function matchesFilter(status: OrderStatus, filter: FilterKey): boolean {
  if (filter === "all") return true
  if (filter === "Packed") return status === "Ready To Pack" || status === "Packed"
  if (filter === "Pickup Pending") return status === "Pickup Requested"
  if (filter === "Shipped") return status === "Picked Up" || status === "In Transit" || status === "Out For Delivery"
  return status === filter
}

export default function SellerOrdersPage() {
  const gate = useSellerGate()
  const { getProductById } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [wallet, setWallet] = useState<SellerWallet | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [requesting, setRequesting] = useState(false)

  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState("")

  function refreshWallet() {
    fetchMyWallet().then((result) => {
      if (result.ok) {
        setWallet(result.wallet)
        setWithdrawals(result.withdrawals)
      }
    })
  }

  useEffect(() => {
    if (!sellerUid) return
    getOrdersBySeller(sellerUid).then(setOrders)
    refreshWallet()
  }, [sellerUid])

  async function handleRequestWithdrawal() {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    setRequesting(true)
    const result = await requestWithdrawal(amount)
    setRequesting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Withdrawal requested.")
    setWithdrawAmount("")
    refreshWallet()
  }

  const rows = useMemo(() => {
    if (!orders || !sellerUid) return []
    return orders
      .map((order) => ({ order, mine: order.sellerOrders.find((so) => so.sellerId === sellerUid) }))
      .filter((r): r is { order: Order; mine: NonNullable<typeof r.mine> } => !!r.mine)
  }, [orders, sellerUid])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ order, mine }) => {
      if (!matchesFilter(mine.status, filter)) return false
      if (dateFilter && !order.createdAt.startsWith(dateFilter)) return false
      if (q) {
        const idMatch = order.id.toLowerCase().includes(q)
        const nameMatch = order.shippingAddress.fullName.toLowerCase().includes(q)
        const trackingMatch = mine.trackingNumber?.toLowerCase().includes(q)
        const productMatch = mine.items.some((i) => (getProductById(i.productId)?.name ?? "").toLowerCase().includes(q))
        if (!idMatch && !nameMatch && !trackingMatch && !productMatch) return false
      }
      return true
    })
  }, [rows, filter, dateFilter, search, getProductById])

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
    if (gate.state === "rejected") {
      return (
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="mb-4">{gate.reason || "Your seller application was rejected. Please review and resubmit."}</p>
          <Link href="/sell/register" className="text-green-700 underline underline-offset-4">
            Edit &amp; Resubmit
          </Link>
        </div>
      )
    }
    const message =
      gate.state === "not-applied" ? "You haven't applied to become a seller yet." : "Your seller application is pending admin approval."
    return <div className="mx-auto max-w-6xl px-4 py-16">{message}</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Order Fulfillment</h1>
          <p className="mt-1 text-sm text-[#444444]">Only your own items within each order are shown here.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/seller/shipping" className="text-sm font-medium text-green-700 hover:underline">
            Shipping Dashboard
          </Link>
        </div>
      </div>

      {wallet && (
        <section id="wallet" className="mt-6 scroll-mt-20 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <WalletIcon className="size-4 text-green-700" />
            Wallet
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <WalletTile label="Available Balance" value={wallet.balance} highlight />
            <WalletTile label="On Hold" value={wallet.onHoldBalance} />
            <WalletTile label="Pending Settlement" value={wallet.pendingSettlement} />
            <WalletTile label="Lifetime Earnings" value={wallet.lifetimeEarnings} />
            <WalletTile label="Total Withdrawn" value={wallet.lifetimeWithdrawn} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Amount to withdraw"
              className="h-10 w-48"
            />
            <Button className="h-10" disabled={requesting || wallet.balance <= 0} onClick={handleRequestWithdrawal}>
              {requesting ? "Requesting..." : "Request Withdrawal"}
            </Button>
          </div>
          {withdrawals && withdrawals.length > 0 && (
            <div className="mt-4 flex flex-col gap-1 text-sm text-[#444444]">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex justify-between">
                  <span>
                    {formatPrice(w.amount)} — {new Date(w.requestedAt).toLocaleDateString()}
                  </span>
                  <span className="capitalize">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      <section className="mt-6 flex flex-wrap gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.key ? "border-green-600 bg-green-600 text-white" : "border-border bg-white text-black hover:border-green-600 hover:text-green-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </section>

      {/* Search + date */}
      <section className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#888888]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID, customer name, product, or tracking number..."
            className="h-10 pl-9"
          />
        </div>
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 w-44" />
      </section>

      {/* Orders */}
      <section className="mt-6">
        {orders === null ? (
          <p className="text-sm text-[#444444]">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-16 text-center">
            <PackageSearch className="size-8 text-[#888888]" />
            <p className="mt-3 text-sm text-[#444444]">No orders match this view.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(({ order, mine }) => {
              const total = mine.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
              return (
                <Link
                  key={order.id}
                  href={`/seller/orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-green-600 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-black">
                      #{order.id.slice(0, 8)} · {order.shippingAddress.fullName}
                    </p>
                    <p className="text-xs text-[#888888]">
                      {new Date(order.createdAt).toLocaleString()} · {mine.items.length} item{mine.items.length === 1 ? "" : "s"} ·{" "}
                      {formatPrice(total)}
                    </p>
                    <p className="text-xs text-[#444444]">
                      Earnings {formatPrice(mine.payoutAmount)} · Commission {formatPrice(mine.commissionAmount)}
                    </p>
                  </div>
                  <OrderStatusBadge status={mine.status} />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function WalletTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", highlight ? "border-green-600 bg-green-50" : "border-border bg-white")}>
      <p className="text-xs uppercase tracking-widest text-[#888888]">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", highlight ? "text-green-700" : "text-black")}>{formatPrice(value)}</p>
    </div>
  )
}
