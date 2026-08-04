import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Order } from "@/types/order"
import type { ReportsData, ReportDailyPoint, ReportSellerRow, ReportProductRow, ReportCustomerRow } from "@/types/reports"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * One bounded orders-range fetch; every report grouping (Sales, Revenue,
 * Sellers, Products, Customers) is derived from that single pass rather
 * than 5 separate heavy queries — they all group/filter along a dimension
 * (day, seller, product, buyer) Firestore's sum()/count() aggregates can't
 * express directly (can't reduce a nested array), so this is fetch-and-
 * reduce, same approach as the dashboard's revenue tiles.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "reports_analytics")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(defaultFrom.getDate() - 29)
  const from = searchParams.get("from") ?? defaultFrom.toISOString()
  const to = searchParams.get("to") ?? now.toISOString()

  const db = getAdminDb()
  const snap = await db.collection("orders").where("createdAt", ">=", from).where("createdAt", "<=", to).get()
  const orders = snap.docs.map((d) => d.data() as Order)

  const dailyMap = new Map<string, ReportDailyPoint>()
  const sellerMap = new Map<string, ReportSellerRow>()
  const productMap = new Map<string, ReportProductRow>()
  const customerMap = new Map<string, ReportCustomerRow>()

  let totalOrders = 0
  let totalRevenue = 0
  let totalDiscount = 0
  let totalShipping = 0

  for (const order of orders) {
    totalOrders += 1
    totalDiscount += order.totals.discount
    totalShipping += order.totals.shipping

    const day = dayKey(order.createdAt)
    const dayPoint = dailyMap.get(day) ?? { date: day, orders: 0, revenue: 0 }
    dayPoint.orders += 1

    const customerRow = customerMap.get(order.buyerId) ?? { buyerId: order.buyerId, email: order.contactEmail, orders: 0, spend: 0 }
    customerRow.orders += 1
    customerRow.spend += order.totals.total
    customerMap.set(order.buyerId, customerRow)

    for (const sellerOrder of order.sellerOrders) {
      if (sellerOrder.status === "Cancelled") continue
      const sellerRow = sellerMap.get(sellerOrder.sellerId) ?? { sellerId: sellerOrder.sellerId, orders: 0, revenue: 0, payout: 0 }
      sellerRow.orders += 1
      sellerRow.payout += sellerOrder.payoutAmount

      for (const item of sellerOrder.items) {
        const lineRevenue = item.price * item.quantity
        sellerRow.revenue += lineRevenue
        totalRevenue += lineRevenue
        dayPoint.revenue += lineRevenue

        const productRow = productMap.get(item.productId) ?? { productId: item.productId, productName: item.productId, units: 0, revenue: 0 }
        productRow.units += item.quantity
        productRow.revenue += lineRevenue
        productMap.set(item.productId, productRow)
      }
      sellerMap.set(sellerOrder.sellerId, sellerRow)
    }

    dailyMap.set(day, dayPoint)
  }

  // Resolve real product names for the Products report — OrderItem only
  // stores productId, not a name snapshot. Bounded to the distinct products
  // that actually appear in this date range.
  const productIds = Array.from(productMap.keys())
  if (productIds.length > 0) {
    const productRefs = productIds.map((id) => db.collection("products").doc(id))
    const productSnaps = await db.getAll(...productRefs)
    for (const snap of productSnaps) {
      const row = productMap.get(snap.id)
      if (row && snap.exists) row.productName = (snap.data()?.name as string) ?? snap.id
    }
  }

  const data: ReportsData = {
    from,
    to,
    totals: { orders: totalOrders, revenue: round2(totalRevenue), discount: round2(totalDiscount), shipping: round2(totalShipping) },
    dailySeries: Array.from(dailyMap.values())
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => ({ ...d, revenue: round2(d.revenue) })),
    bySeller: Array.from(sellerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => ({ ...s, revenue: round2(s.revenue), payout: round2(s.payout) })),
    byProduct: Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => ({ ...p, revenue: round2(p.revenue) })),
    byCustomer: Array.from(customerMap.values())
      .sort((a, b) => b.spend - a.spend)
      .map((c) => ({ ...c, spend: round2(c.spend) })),
  }

  return NextResponse.json(data)
}
