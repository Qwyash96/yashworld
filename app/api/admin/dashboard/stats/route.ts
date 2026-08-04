import { NextResponse, type NextRequest } from "next/server"
import { AggregateField } from "firebase-admin/firestore"
import { requireAnyAdmin } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getAllSupportTickets } from "@/services/support-ticket.service"
import type { Order } from "@/types/order"
import type { Product } from "@/types/product"
import type { DashboardStats, DashboardChartPoint } from "@/types/dashboard-stats"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const CHART_DAYS = 14
const LOW_STOCK_THRESHOLD = 5

/** Sum of (price × quantity) across every non-cancelled sellerOrder in these
 * orders — the same "filter at the sellerOrder granularity" revenue
 * definition used by the existing seller-side calc in
 * app/seller/products/page.tsx, just summed platform-wide. Firestore's
 * sum() aggregate can't express this (it can't filter/reduce a nested
 * array), so this is a bounded fetch-and-reduce, not an aggregate query. */
function sumRevenue(orders: Order[]): number {
  let total = 0
  for (const order of orders) {
    for (const sellerOrder of order.sellerOrders) {
      if (sellerOrder.status === "Cancelled") continue
      for (const item of sellerOrder.items) total += item.price * item.quantity
    }
  }
  return total
}

function dayKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = getAdminDb()
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const chartStart = new Date(startOfDay)
  chartStart.setDate(chartStart.getDate() - (CHART_DAYS - 1))
  const revenueQueryStart = chartStart < startOfMonth ? chartStart : startOfMonth

  const [
    totalBuyers,
    totalSellers,
    pendingSellerApprovals,
    newUsersToday,
    activeUsersToday,
    ordersToday,
    pendingWithdrawals,
    revenueOrdersSnap,
    lowStockSnap,
    topSellingSnap,
  ] = await Promise.all([
    db.collection("users").where("role", "==", "buyer").count().get(),
    db.collection("sellers").count().get(),
    db.collection("sellerApplications").where("status", "==", "pending").count().get(),
    db.collection("users").where("createdAt", ">=", startOfDay.toISOString()).count().get(),
    db.collection("presence").where("lastSeenAt", ">=", startOfDay.toISOString()).count().get(),
    db.collection("orders").where("createdAt", ">=", startOfDay.toISOString()).count().get(),
    db
      .collection("withdrawalRequests")
      .where("status", "==", "requested")
      .aggregate({ count: AggregateField.count(), total: AggregateField.sum("amount") })
      .get(),
    db.collection("orders").where("createdAt", ">=", revenueQueryStart.toISOString()).get(),
    db
      .collection("products")
      .where("status", "==", "approved")
      .where("stock", "<=", LOW_STOCK_THRESHOLD)
      .orderBy("stock", "asc")
      .limit(10)
      .get(),
    db.collection("products").where("status", "==", "approved").orderBy("unitsSold", "desc").limit(10).get(),
  ])

  const revenueOrders = revenueOrdersSnap.docs.map((d) => d.data() as Order)
  const todayOrders = revenueOrders.filter((o) => o.createdAt >= startOfDay.toISOString())
  const monthOrders = revenueOrders.filter((o) => o.createdAt >= startOfMonth.toISOString())

  const chartByDay = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < CHART_DAYS; i++) {
    const d = new Date(chartStart)
    d.setDate(d.getDate() + i)
    chartByDay.set(dayKey(d.toISOString()), { revenue: 0, orders: 0 })
  }
  for (const order of revenueOrders) {
    const key = dayKey(order.createdAt)
    const bucket = chartByDay.get(key)
    if (!bucket) continue
    bucket.orders += 1
    bucket.revenue += sumRevenue([order])
  }
  const revenueChart: DashboardChartPoint[] = Array.from(chartByDay.entries()).map(([date, v]) => ({
    date,
    revenue: round2(v.revenue),
    orders: v.orders,
  }))

  const allTickets = await getAllSupportTickets()

  const stats: DashboardStats = {
    totalBuyers: totalBuyers.data().count,
    totalSellers: totalSellers.data().count,
    pendingSellerApprovals: pendingSellerApprovals.data().count,
    newUsersToday: newUsersToday.data().count,
    activeUsersToday: activeUsersToday.data().count,
    ordersToday: ordersToday.data().count,
    revenueToday: round2(sumRevenue(todayOrders)),
    monthlyRevenue: round2(sumRevenue(monthOrders)),
    pendingWithdrawalsCount: pendingWithdrawals.data().count,
    pendingWithdrawalsAmount: round2(pendingWithdrawals.data().total ?? 0),
    recentSupportTickets: allTickets.slice(0, 5).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
    })),
    lowStockProducts: lowStockSnap.docs.map((d) => {
      const p = d.data() as Product
      return { id: d.id, name: p.name, stock: p.stock, sellerId: p.sellerId }
    }),
    topSellingProducts: topSellingSnap.docs.map((d) => {
      const p = d.data() as Product
      return { id: d.id, name: p.name, unitsSold: p.unitsSold ?? 0, price: p.price }
    }),
    revenueChart,
  }

  return NextResponse.json(stats)
}
