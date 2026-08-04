"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  Home,
  LayoutDashboard,
  Bell,
  Users,
  ShoppingBag,
  ClipboardList,
  Wallet,
  Megaphone,
  BarChart3,
  Settings,
  LifeBuoy,
  ShieldCheck,
  LogOut,
  Plug,
  type LucideIcon,
} from "lucide-react"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { logoutUser } from "@/services/auth.service"
import { hasPermission, isAdminRole, ROLE_LABELS, type AdminPermission } from "@/lib/admin-roles"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/user"

type AdminSectionItem = {
  label: string
  href: string
  superAdminOnly?: boolean
  /** Overrides the parent section's permission for this one item — lets a
   * section mix sub-items that belong to different roles (e.g. "Users"
   * holds both Buyers/Staff, which only super_admin manages, and Sellers,
   * which operations also needs to reach). Falls back to the section's
   * permission when unset. */
  permission?: AdminPermission
}

type AdminSection = {
  label: string
  icon: LucideIcon
  permission: AdminPermission
  items: AdminSectionItem[]
}

export const adminSections: AdminSection[] = [
  {
    label: "Users",
    icon: Users,
    permission: "user_management",
    items: [
      { label: "Buyers", href: "/admin/users", permission: "user_management" },
      { label: "Sellers", href: "/admin/sellers", permission: "seller_management" },
      { label: "Staff", href: "/admin/staff", permission: "admin_management" },
      { label: "Roles & Permissions", href: "/admin/staff", permission: "admin_management" },
    ],
  },
  {
    label: "Catalog",
    icon: ShoppingBag,
    permission: "product_management",
    items: [
      { label: "Products", href: "/admin/products", permission: "product_management" },
      { label: "Categories", href: "/admin/categories", permission: "product_management" },
      { label: "Brands", href: "#", permission: "product_management" },
      { label: "Inventory", href: "#", permission: "product_management" },
      { label: "Reviews", href: "#", permission: "reviews" },
    ],
  },
  {
    label: "Orders",
    icon: ClipboardList,
    permission: "order_management",
    items: [
      { label: "All Orders", href: "/admin/orders" },
      { label: "Returns", href: "#" },
    ],
  },
  {
    // The finance role's primary section — every item here is reachable by
    // "payments"-permission roles (finance, admin), NOT superAdminOnly,
    // since finance's whole job is exactly this content. "Payment Settings"
    // is deliberately first. Each of the 6 payment-gateway links points at
    // its own /admin/integrations/{id} page (the generic Plug-and-Play
    // Integration System) — registering these specific paths here is what
    // gives "payments"-holders a route-guard override on those exact pages
    // without opening the rest of /admin/integrations (still settings-only,
    // see the Integrations section below).
    label: "Payments",
    icon: Wallet,
    permission: "payments",
    items: [
      { label: "Payment Settings", href: "/admin/integrations/razorpay" },
      { label: "Cashfree", href: "/admin/integrations/cashfree" },
      { label: "PhonePe PG", href: "/admin/integrations/phonepe" },
      { label: "PayU", href: "/admin/integrations/payu" },
      { label: "Stripe", href: "/admin/integrations/stripe" },
      { label: "PayPal", href: "/admin/integrations/paypal" },
      { label: "Payouts", href: "/admin/payouts" },
      { label: "Refunds", href: "/admin/refunds" },
      { label: "Settlements", href: "/admin/settlements" },
    ],
  },
  {
    label: "Integrations",
    icon: Plug,
    permission: "settings",
    items: [
      { label: "All Integrations", href: "/admin/integrations", superAdminOnly: true },
      { label: "Payment Gateways", href: "/admin/integrations?category=payment", superAdminOnly: true },
      { label: "Shipping", href: "/admin/integrations?category=shipping", superAdminOnly: true },
      { label: "Checkout (GoKwik)", href: "/admin/integrations?category=checkout", superAdminOnly: true },
      { label: "WhatsApp", href: "/admin/integrations?category=whatsapp", superAdminOnly: true },
      { label: "Email", href: "/admin/integrations?category=email", superAdminOnly: true },
      { label: "SMS", href: "/admin/integrations?category=sms", superAdminOnly: true },
      { label: "Analytics", href: "/admin/integrations?category=analytics", superAdminOnly: true },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    permission: "marketing",
    items: [
      { label: "Home Banners", href: "/admin/banners", permission: "coupons_offers" },
      { label: "Sponsored Ads", href: "/admin/sponsored-ads", permission: "coupons_offers" },
      { label: "Coupons", href: "/admin/coupons", permission: "coupons_offers" },
      { label: "Campaigns", href: "/admin/campaigns", permission: "coupons_offers" },
      { label: "Notifications", href: "#", permission: "marketing" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    permission: "reports_analytics",
    items: [
      { label: "Sales", href: "/admin/reports/sales" },
      { label: "Revenue", href: "/admin/reports/revenue" },
      { label: "Sellers", href: "/admin/reports/sellers" },
      { label: "Products", href: "/admin/reports/products" },
      { label: "Customers", href: "/admin/reports/customers" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    permission: "settings",
    items: [
      { label: "General Settings", href: "/admin/settings/general", superAdminOnly: true },
      { label: "Shipping", href: "/admin/settings/shipping", superAdminOnly: true },
      { label: "Tax / GST", href: "#" },
      { label: "Email & SMS", href: "#" },
      { label: "Security", href: "/admin/settings/security", superAdminOnly: true },
      { label: "Social Links", href: "/admin/settings/social", superAdminOnly: true },
      { label: "Commission", href: "/admin/settings/commission", superAdminOnly: true },
    ],
  },
  {
    label: "Support",
    icon: LifeBuoy,
    permission: "support",
    items: [
      { label: "Support Tickets", href: "/admin/support" },
      { label: "Contact Messages", href: "#" },
      { label: "FAQ", href: "#" },
    ],
  },
  {
    // "security" is held by no non-super_admin role (see
    // lib/admin-roles.ts ROLE_PERMISSIONS) — same gate as the route's own
    // requireSuperAdmin, so the sidebar and the route guard agree, no drift.
    label: "Security",
    icon: ShieldCheck,
    permission: "security",
    items: [{ label: "Audit Logs", href: "/admin/audit-logs" }],
  },
]

/**
 * Every real (non-"#") route in adminSections, flattened to {path, permission}
 * — path is what an item's href resolves to with any #hash fragment stripped
 * (Payments' items link to /admin/settings/payments#section-name; the
 * permission applies to the whole page, not a fragment).
 *
 * This is THE single source of truth app/admin/layout.tsx's route guard
 * reads from (via getPermissionForPath, below) instead of maintaining its
 * own separate list — a second hand-maintained copy is exactly what let the
 * sidebar and the route guard drift out of sync before (sidebar showed a
 * section as accessible while the route guard, working off a stale/partial
 * list, denied it).
 */
const PATH_PERMISSIONS: { path: string; permission: AdminPermission }[] = adminSections.flatMap((section) =>
  section.items
    .filter((item) => item.href !== "#")
    .map((item) => ({ path: item.href.split(/[#?]/)[0]!, permission: item.permission ?? section.permission })),
)

// Routes any admin role may reach — same standing as the sidebar's own
// ungated Home/Dashboard/Notifications links above (not part of
// adminSections since they're not permission-scoped sections).
const UNGATED_PATHS = ["/admin", "/admin/notifications"]

/**
 * Which permission a given /admin/* pathname requires, per the same data
 * that drives sidebar visibility. Matches the longest registered path that
 * is a prefix of pathname, so dynamic routes (e.g. /admin/sellers/[id]) are
 * covered by their list page's entry (/admin/sellers) without needing a
 * separate entry. Returns null for UNGATED_PATHS (every admin role may
 * land there — their own query/content narrows by role) and undefined for
 * anything not registered here at all, which callers should treat as
 * "requires super_admin" — a secure-by-default fallback for any future
 * page that forgets to add itself to adminSections.
 */
export function getPermissionForPath(pathname: string): AdminPermission | null | undefined {
  if (UNGATED_PATHS.includes(pathname)) return null
  const match = PATH_PERMISSIONS.filter((p) => pathname === p.path || pathname.startsWith(`${p.path}/`)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]
  return match?.permission
}

/**
 * Which sections/items a role can actually see, per the same adminSections
 * data getPermissionForPath reads from — the single source of truth shared
 * by the sidebar (this function), the route guard (app/admin/layout.tsx),
 * and the dashboard root's role-appropriate content (app/admin/page.tsx).
 * Explicit for super_admin, not just implied by hasPermission's
 * short-circuit: super_admin always sees every section, full stop,
 * regardless of anything else about their account.
 */
export function getVisibleAdminSections(role: UserRole | undefined | null): AdminSection[] {
  if (role === "super_admin") return adminSections
  if (!isAdminRole(role)) return []
  return adminSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(role, item.permission ?? section.permission)),
    }))
    .filter((section) => section.items.length > 0)
}

/**
 * The actual admin navigation — used both by the always-visible desktop
 * `<aside>` (AdminSidebar, below) and by the mobile hamburger drawer
 * (app/admin/layout.tsx's Sheet). This is the ONE place admin nav content
 * lives; there is no other component that can render it, so there is
 * nothing else to "pick the wrong menu."
 */
export function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const staff = useAdminAuth()
  const role = staff.role

  // DEV_SHOW_ADMIN_MENU_TO_ALL (lib/dev-flags.ts): temporary, frontend-only —
  // remove this branch to restore role-based menu visibility.
  const visibleSections = DEV_SHOW_ADMIN_MENU_TO_ALL ? adminSections : getVisibleAdminSections(role)

  async function handleLogout() {
    await logoutUser()
    router.push("/admin/login")
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 rounded-xl bg-green-50 px-3 py-2.5">
        <p className="truncate text-sm font-bold text-black">{staff.name}</p>
        <p className="text-xs text-green-700">{isAdminRole(staff.role) ? ROLE_LABELS[staff.role] : staff.role}</p>
      </div>

      {/* Home — every admin-role user can leave to the storefront; no permission gate. */}
      <Link
        href="/"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-green-50 hover:text-green-700",
          pathname === "/" ? "bg-green-50 text-green-700" : "text-black",
        )}
      >
        <Home className="size-4 shrink-0 text-green-700" />
        Home
      </Link>

      {/* Dashboard ("/admin") — every admin role lands here after login (see
          app/admin/login/page.tsx) and app/admin/page.tsx adapts its content
          per role, so this link (like Home) needs no permission gate. */}
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
      >
        <LayoutDashboard className="size-4 shrink-0 text-green-700" />
        Dashboard
      </Link>

      {/* Notifications — the alerts feed (distinct from the "Marketing >
          Notifications" placeholder below, which is outbound marketing
          campaigns). Its own query narrows by the viewer's permissions, so
          like Dashboard this needs no gate here. */}
      <Link
        href="/admin/notifications"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
      >
        <Bell className="size-4 shrink-0 text-green-700" />
        Notifications
      </Link>

      <Accordion className="flex w-full flex-col gap-1 overflow-y-auto">
        {visibleSections.map((section) => {
          const Icon = section.icon
          return (
            <AccordionItem key={section.label} value={section.label} className="border-none">
              <AccordionTrigger className="rounded-xl px-3 py-2.5 text-sm font-medium text-black hover:bg-green-50 hover:text-green-700 hover:no-underline [&_svg]:text-green-700">
                <span className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-green-700" />
                  {section.label}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1 pl-10">
                  {section.items
                    .filter((item) => DEV_SHOW_ADMIN_MENU_TO_ALL || !item.superAdminOnly || staff.role === "super_admin")
                    .map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={onNavigate}
                        className="rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-green-50 hover:text-green-700"
                      >
                        {item.label}
                      </Link>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      <button
        onClick={handleLogout}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
      >
        <LogOut className="size-4 shrink-0" />
        Log Out
      </button>
    </div>
  )
}

/** Desktop-only — lg and up. Mobile gets the hamburger drawer in app/admin/layout.tsx instead. */
export function AdminSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 rounded-2xl border border-border bg-white shadow-sm lg:block">
      <AdminSidebarContent />
    </aside>
  )
}
