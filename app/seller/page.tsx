"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { IndianRupee, ShoppingBag, Clock, PackageX } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { getProductsBySeller } from "@/services/product.service"
import { fetchMySellerOrders } from "@/lib/seller-orders-client"
import { formatPrice } from "@/lib/products"
import { KpiCard } from "@/components/seller/dashboard/kpi-card"
import { RecentOrderActivity, type RecentActivityRow } from "@/components/seller/dashboard/recent-order-activity"
import { FeatureStrip } from "@/components/seller/dashboard/feature-strip"
import type { SalesTrendPoint } from "@/components/seller/dashboard/sales-trend-chart"
import type { Product } from "@/types/product"
import type { OrderStatus } from "@/types/order"

// recharts is a genuinely heavy dependency — code-split out of the initial
// bundle, same reasoning/pattern as app/admin/page.tsx's RevenueChart.
const SalesTrendChart = dynamic(() => import("@/components/seller/dashboard/sales-trend-chart").then((m) => m.SalesTrendChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-gray-100" />,
})

const PENDING_STATUSES = new Set(["Pending", "Accepted", "Ready To Pack", "Packed", "Pickup Requested", "Picked Up", "In Transit", "Out For Delivery"])
const LOW_STOCK_THRESHOLD = 5
const CHART_DAYS = 30

interface SellerOrderEntry {
  orderId: string
  createdAt: string
  customerName: string
  productName: string
  status: OrderStatus
  itemsTotal: number
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** The seller's landing page — a real overview built from the same data
 * every other seller page already fetches (products, orders), not a
 * placeholder. All figures below are computed from that real data; nothing
 * here is hardcoded/fabricated. */
export default function SellerDashboardPage() {
  const gate = useSellerGate()
  const { user, getProductById } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [products, setProducts] = useState<Product[] | null>(null)
  const [entries, setEntries] = useState<SellerOrderEntry[] | null>(null)

  useEffect(() => {
    if (!sellerUid) return
    getProductsBySeller(sellerUid).then(setProducts)
    fetchMySellerOrders().then((orders) => {
      const rows: SellerOrderEntry[] = []
      for (const order of orders) {
        const mine = order.sellerOrders.find((so) => so.sellerId === sellerUid)
        if (!mine) continue
        const itemsTotal = mine.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const firstItemName = getProductById(mine.items[0]?.productId ?? "")?.name ?? mine.items[0]?.productId ?? "—"
        rows.push({
          orderId: order.id,
          createdAt: order.createdAt,
          customerName: order.shippingAddress.fullName,
          productName: mine.items.length > 1 ? `${firstItemName} +${mine.items.length - 1}` : firstItemName,
          status: mine.status,
          itemsTotal,
        })
      }
      setEntries(rows)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerUid])

  const lowStockCount = useMemo(() => (products ?? []).filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length, [products])

  const { pendingCount, thisMonthTotal, trendLabel, chartData, recentRows } = useMemo(() => {
    if (!entries) {
      return { pendingCount: null, thisMonthTotal: null, trendLabel: undefined, chartData: [] as SalesTrendPoint[], recentRows: [] as RecentActivityRow[] }
    }

    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`

    let thisMonth = 0
    let lastMonth = 0
    for (const e of entries) {
      const d = new Date(e.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (key === thisMonthKey) thisMonth += e.itemsTotal
      else if (key === lastMonthKey) lastMonth += e.itemsTotal
    }

    const trend =
      lastMonth > 0
        ? (() => {
            const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
            return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% from last month`
          })()
        : undefined

    // Real 30-day daily revenue series — no fabricated numbers; days with
    // no orders simply show 0, matching the empty-state guidance for
    // sellers with little/no order history yet.
    const byDay = new Map<string, number>()
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      byDay.set(dayKey(d.toISOString()), 0)
    }
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - CHART_DAYS)
    for (const e of entries) {
      if (new Date(e.createdAt) < cutoff) continue
      const key = dayKey(e.createdAt)
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + e.itemsTotal)
    }
    const series: SalesTrendPoint[] = Array.from(byDay.entries()).map(([date, revenue]) => ({ date, revenue }))

    const sorted = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    return {
      pendingCount: entries.filter((e) => PENDING_STATUSES.has(e.status)).length,
      thisMonthTotal: thisMonth,
      trendLabel: trend,
      chartData: series,
      recentRows: sorted.slice(0, 5).map((e) => ({ orderId: e.orderId, customerName: e.customerName, productName: e.productName, status: e.status })),
    }
  }, [entries])

  if (gate.state === "loading") {
    return <div className="py-16 text-center text-sm text-[#444444]">Loading...</div>
  }
  if (gate.state !== "approved") {
    return <div className="py-16 text-center text-sm text-[#444444]">You need an approved seller account to view this page.</div>
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-[28px]">Welcome, {user?.name || "Seller"}!</h1>
        <p className="mt-1 text-sm text-gray-500">Here&apos;s what&apos;s happening with your store today.</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={IndianRupee}
          label="Total Sales"
          sublabel="This Month"
          value={thisMonthTotal === null ? "—" : formatPrice(thisMonthTotal)}
          trend={trendLabel}
        />
        <KpiCard icon={ShoppingBag} label="Total Orders" sublabel="This Month" value={entries?.length ?? "—"} />
        <KpiCard
          icon={Clock}
          label="Pending Orders"
          value={pendingCount ?? "—"}
          tone="amber"
          action={{ label: "View Orders", href: "/seller/orders" }}
        />
        <KpiCard
          icon={PackageX}
          label="Low Stock Items"
          value={products === null ? "—" : lowStockCount}
          tone="red"
          action={{ label: "Restock Now", href: "/seller/products" }}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:col-span-3">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Sales Trend (Last 30 Days)</h2>
          {entries === null ? <div className="mt-4 h-64 animate-pulse rounded-xl bg-gray-100" /> : <div className="mt-3"><SalesTrendChart data={chartData} /></div>}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Recent Order Activity</h2>
          <div className="mt-3">
            {entries === null ? (
              <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
            ) : (
              <RecentOrderActivity rows={recentRows} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <FeatureStrip />
      </div>
    </div>
  )
}
