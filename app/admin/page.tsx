"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Users,
  Store,
  ClipboardCheck,
  UserPlus,
  Activity,
  Radio,
  ShoppingBag,
  IndianRupee,
  CalendarDays,
  Wallet,
  LifeBuoy,
  PackageX,
  TrendingUp,
  Megaphone,
  Tag,
  Image as ImageIcon,
} from "lucide-react"
import { getPendingProducts, approveProduct, rejectProduct } from "@/services/product.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { getVisibleAdminSections } from "@/components/admin/admin-sidebar"
import { hasPermission, isAdminRole, type AdminPermission } from "@/lib/admin-roles"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { StatTile } from "@/components/admin/dashboard/stat-tile"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { formatPrice } from "@/lib/products"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/**
 * The dashboard root ("/admin") — every admin login lands here, for every
 * role. Every section below is gated by the same hasPermission() check the
 * sidebar and route guard use, so this page can never claim data a role
 * doesn't actually have access to. Roles with no visible section at all
 * fall back to a plain "here's what you can access" landing list.
 */
export default function AdminDashboardPage() {
  const admin = useAdminAuth()
  const { stats, statsError, recentOrders, recentRegistrations, onlineUsers, loading } = useDashboardStats()

  function has(permission: AdminPermission): boolean {
    return DEV_SHOW_ADMIN_MENU_TO_ALL || admin.role === "super_admin" || (isAdminRole(admin.role) && hasPermission(admin.role, permission))
  }

  const showUsers = has("user_management")
  const showSellers = has("seller_management")
  const showOrders = has("order_management")
  const showPayments = has("payments")
  const showReports = has("reports_analytics")
  const showProducts = has("product_management")
  const showSupport = has("support")
  const showMarketing = has("coupons_offers") || has("marketing")

  const anySection =
    showUsers || showSellers || showOrders || showPayments || showReports || showProducts || showSupport || showMarketing

  if (!anySection) {
    return <RoleLandingPage />
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-black">Dashboard</h1>
      <p className="mt-1 text-sm text-[#444444]">Welcome back, {admin.name}.</p>

      {statsError && <p className="mt-4 text-sm text-destructive">{statsError}</p>}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {showUsers && <StatTile icon={Users} label="Total Buyers" value={stats.totalBuyers} />}
            {showSellers && <StatTile icon={Store} label="Total Sellers" value={stats.totalSellers} />}
            {showSellers && (
              <StatTile icon={ClipboardCheck} label="Pending Seller Approvals" value={stats.pendingSellerApprovals} />
            )}
            {showUsers && <StatTile icon={UserPlus} label="New Users Today" value={stats.newUsersToday} />}
            {showUsers && <StatTile icon={Activity} label="Active Users Today" value={stats.activeUsersToday} />}
            {showUsers && <StatTile icon={Radio} label="Online Users" value={onlineUsers} live />}
            {showOrders && <StatTile icon={ShoppingBag} label="Orders Today" value={stats.ordersToday} />}
            {showPayments && <StatTile icon={IndianRupee} label="Revenue Today" value={formatPrice(stats.revenueToday)} />}
            {showPayments && <StatTile icon={CalendarDays} label="Monthly Revenue" value={formatPrice(stats.monthlyRevenue)} />}
            {showPayments && (
              <StatTile
                icon={Wallet}
                label="Pending Withdrawals"
                value={stats.pendingWithdrawalsCount}
                hint={formatPrice(stats.pendingWithdrawalsAmount)}
              />
            )}
            {showSupport && <StatTile icon={LifeBuoy} label="Open Support Tickets" value={stats.openSupportTicketsCount} />}
            {showProducts && <StatTile icon={PackageX} label="Low Stock Products" value={stats.lowStockProducts.length} />}
            {showProducts && <StatTile icon={TrendingUp} label="Top Selling Products" value={stats.topSellingProducts.length} />}
            {showMarketing && <StatTile icon={Megaphone} label="Active Campaigns" value={stats.activeCampaignsCount} />}
            {showMarketing && <StatTile icon={Tag} label="Active Coupons" value={stats.activeCouponsCount} />}
            {showMarketing && <StatTile icon={ImageIcon} label="Live Banners" value={stats.activeBannersCount} />}
          </div>

          {showReports && (
            <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Revenue — Last 14 Days</h2>
              <div className="mt-4">
                <RevenueChart data={stats.revenueChart} />
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {showOrders && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
                  Recent Orders
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-green-500" /> Live
                  </span>
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  {recentOrders.length === 0 && <p className="text-sm text-[#444444]">No orders yet.</p>}
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm hover:bg-green-50"
                    >
                      <span className="truncate text-black">{order.contactEmail}</span>
                      <span className="shrink-0 font-semibold text-black">{formatPrice(order.total)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {showUsers && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
                  Recent Registrations
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-green-500" /> Live
                  </span>
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  {recentRegistrations.length === 0 && <p className="text-sm text-[#444444]">No registrations yet.</p>}
                  {recentRegistrations.map((r) => (
                    <div key={r.uid} className="rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                      <p className="truncate font-medium text-black">{r.name}</p>
                      <p className="truncate text-xs text-[#444444]">
                        {r.email} · {r.role}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showSupport && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Recent Support Tickets</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {stats.recentSupportTickets.length === 0 && <p className="text-sm text-[#444444]">No tickets yet.</p>}
                  {stats.recentSupportTickets.map((t) => (
                    <Link
                      key={t.id}
                      href="/admin/support"
                      className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm hover:bg-green-50"
                    >
                      <span className="truncate text-black">{t.subject}</span>
                      <Badge variant="secondary">{t.status}</Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {showProducts && (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Low Stock Products</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {stats.lowStockProducts.length === 0 && <p className="text-sm text-[#444444]">Nothing running low.</p>}
                  {stats.lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                      <span className="truncate text-black">{p.name}</span>
                      <span className="shrink-0 font-semibold text-red-600">{p.stock} left</span>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Top Selling Products</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {stats.topSellingProducts.length === 0 && <p className="text-sm text-[#444444]">No sales yet.</p>}
                  {stats.topSellingProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                      <span className="truncate text-black">{p.name}</span>
                      <span className="shrink-0 font-semibold text-black">{p.unitsSold} sold</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      ) : null}

      {showProducts && (
        <div className="mt-10">
          <ProductModerationPanel />
        </div>
      )}
    </div>
  )
}

function RoleLandingPage() {
  const admin = useAdminAuth()
  const sections = getVisibleAdminSections(admin.role)
  // Same superAdminOnly filter AdminSidebarContent applies to its item list —
  // without it this could link to a page that passes the route guard (its
  // permission is held by this role) but still dead-ends on that page's own
  // stricter super_admin-only inline check (e.g. Payment Settings).
  const links = Array.from(
    new Map(
      sections
        .flatMap((section) => section.items)
        .filter((item) => item.href !== "#" && (!item.superAdminOnly || admin.role === "super_admin"))
        .map((item) => [item.href, item] as const),
    ).values(),
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-black">Welcome, {admin.name}</h1>
      <p className="mt-2 text-sm text-[#444444]">
        Your role gives you access to the modules below. Use the sidebar, or a link here, to get started.
      </p>

      {links.length === 0 ? (
        <p className="mt-8 text-sm text-[#444444]">
          Your role doesn't have any modules built yet — check back soon, or contact a Super Admin if you
          believe this is a mistake.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-colors hover:bg-green-50 hover:text-green-700"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProductModerationPanel() {
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    getPendingProducts().then(setProducts)
  }, [])

  async function handleApprove(id: string) {
    await approveProduct(id)
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  async function handleReject(id: string) {
    await rejectProduct(id)
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Product Moderation</h2>
      <p className="mt-1 text-sm text-[#444444]">Products awaiting review before they appear in the store.</p>

      {products === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="mt-4 text-sm text-[#444444]">No products pending review.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white shadow-sm">
          {products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-black">{product.name}</p>
                <p className="text-sm text-[#444444]">
                  {formatPrice(product.price)} · Seller {product.sellerId}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{product.status}</Badge>
                <Button size="sm" onClick={() => handleApprove(product.id)}>
                  Approve
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleReject(product.id)}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
