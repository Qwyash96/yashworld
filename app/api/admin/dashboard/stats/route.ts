import { NextResponse, type NextRequest } from "next/server"
import { AggregateField } from "firebase-admin/firestore"
import { requireAnyAdmin } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { hasPermission } from "@/lib/admin-roles"
import type { Order } from "@/types/order"
import type { Product } from "@/types/product"
import type { SupportTicket } from "@/types/support-ticket"
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

  try {
    const role = auth.role
    const has = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(role, permission)

    const canUsers = has("user_management")
    const canSellers = has("seller_management")
    const canOrders = has("order_management")
    const canPayments = has("payments")
    const canReports = has("reports_analytics")
    const canProducts = has("product_management")
    const canSupport = has("support")
    const canMarketing = has("coupons_offers") || has("marketing")

    const db = getAdminDb()
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const chartStart = new Date(startOfDay)
    chartStart.setDate(chartStart.getDate() - (CHART_DAYS - 1))
    const revenueQueryStart = chartStart < startOfMonth ? chartStart : startOfMonth

    // Every query below is gated by the same permission the client uses to
    // decide whether to render its tile — a role is never charged the cost
    // of, and can never be broken by, data it doesn't hold the permission to
    // see. (Previously every query ran for every role regardless.)
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
      openTicketsCount,
      recentTicketsSnap,
      activeCampaignsCount,
      activeCouponsCount,
      activeBannersCount,
    ] = await Promise.all([
      canUsers ? db.collection("users").where("role", "==", "buyer").count().get() : null,
      canSellers ? db.collection("sellers").count().get() : null,
      canSellers ? db.collection("sellerApplications").where("status", "==", "pending").count().get() : null,
      canUsers ? db.collection("users").where("createdAt", ">=", startOfDay.toISOString()).count().get() : null,
      canUsers ? db.collection("presence").where("lastSeenAt", ">=", startOfDay.toISOString()).count().get() : null,
      canOrders ? db.collection("orders").where("createdAt", ">=", startOfDay.toISOString()).count().get() : null,
      canPayments
        ? db
            .collection("withdrawalRequests")
            .where("status", "==", "requested")
            .aggregate({ count: AggregateField.count(), total: AggregateField.sum("amount") })
            .get()
        : null,
      canPayments || canReports
        ? db.collection("orders").where("createdAt", ">=", revenueQueryStart.toISOString()).get()
        : null,
      canProducts
        ? db
            .collection("products")
            .where("status", "==", "approved")
            .where("stock", "<=", LOW_STOCK_THRESHOLD)
            .orderBy("stock", "asc")
            .limit(10)
            .get()
        : null,
      canProducts
        ? db.collection("products").where("status", "==", "approved").orderBy("unitsSold", "desc").limit(10).get()
        : null,
      // Real aggregate count (previously derived by filtering only the 5
      // most-recent tickets, which undercounted whenever more than 5 tickets
      // were open at once).
      canSupport ? db.collection("supportTickets").where("status", "in", ["new", "open", "in_progress"]).count().get() : null,
      canSupport ? db.collection("supportTickets").orderBy("createdAt", "desc").limit(5).get() : null,
      canMarketing ? db.collection("campaigns").where("status", "==", "active").count().get() : null,
      canMarketing ? db.collection("coupons").where("status", "==", "active").count().get() : null,
      canMarketing ? db.collection("banners").where("active", "==", true).count().get() : null,
    ])

    const revenueOrders = revenueOrdersSnap ? revenueOrdersSnap.docs.map((d) => d.data() as Order) : []
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

    const stats: DashboardStats = {
      totalBuyers: totalBuyers?.data().count ?? 0,
      totalSellers: totalSellers?.data().count ?? 0,
      pendingSellerApprovals: pendingSellerApprovals?.data().count ?? 0,
      newUsersToday: newUsersToday?.data().count ?? 0,
      activeUsersToday: activeUsersToday?.data().count ?? 0,
      ordersToday: ordersToday?.data().count ?? 0,
      revenueToday: round2(sumRevenue(todayOrders)),
      monthlyRevenue: round2(sumRevenue(monthOrders)),
      pendingWithdrawalsCount: pendingWithdrawals?.data().count ?? 0,
      pendingWithdrawalsAmount: round2(pendingWithdrawals?.data().total ?? 0),
      openSupportTicketsCount: openTicketsCount?.data().count ?? 0,
      recentSupportTickets: recentTicketsSnap
        ? recentTicketsSnap.docs.map((d) => {
            const t = d.data() as SupportTicket
            return { id: d.id, subject: t.subject, status: t.status, createdAt: t.createdAt }
          })
        : [],
      lowStockProducts: lowStockSnap
        ? lowStockSnap.docs.map((d) => {
            const p = d.data() as Product
            return { id: d.id, name: p.name, stock: p.stock, sellerId: p.sellerId }
          })
        : [],
      topSellingProducts: topSellingSnap
        ? topSellingSnap.docs.map((d) => {
            const p = d.data() as Product
            return { id: d.id, name: p.name, unitsSold: p.unitsSold ?? 0, price: p.price }
          })
        : [],
      revenueChart,
      activeCampaignsCount: activeCampaignsCount?.data().count ?? 0,
      activeCouponsCount: activeCouponsCount?.data().count ?? 0,
      activeBannersCount: activeBannersCount?.data().count ?? 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[admin/dashboard/stats] failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard stats." },
      { status: 500 },
    )
  }
}
