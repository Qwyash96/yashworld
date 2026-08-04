"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  Home,
  LayoutDashboard,
  Users,
  ShoppingBag,
  ClipboardList,
  Wallet,
  Megaphone,
  BarChart3,
  Settings,
  LifeBuoy,
  LogOut,
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

type AdminSectionItem = {
  label: string
  href: string
  superAdminOnly?: boolean
  /** Overrides the parent section's permission for this one item — lets a
   * section mix sub-items that belong to different roles (e.g. "Users"
   * holds both Buyers/Staff, which only super_admin manages, and Sellers,
   * which seller_manager also needs to reach). Falls back to the section's
   * permission when unset. */
  permission?: AdminPermission
}

type AdminSection = {
  label: string
  icon: LucideIcon
  permission: AdminPermission
  items: AdminSectionItem[]
}

const adminSections: AdminSection[] = [
  {
    label: "Users",
    icon: Users,
    permission: "user_management",
    items: [
      { label: "Buyers", href: "#", permission: "user_management" },
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
      { label: "Categories", href: "#", permission: "product_management" },
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
      { label: "All Orders", href: "#" },
      { label: "Returns", href: "#" },
      { label: "Refunds", href: "#" },
    ],
  },
  {
    label: "Payments",
    icon: Wallet,
    permission: "payments",
    items: [
      { label: "Razorpay Settings", href: "/admin/settings/payments#razorpay-settings", superAdminOnly: true },
      { label: "Payment Methods", href: "/admin/settings/payments#payment-methods", superAdminOnly: true },
      { label: "Checkout Settings", href: "/admin/settings/payments#checkout-settings", superAdminOnly: true },
      { label: "Payment Link", href: "/admin/settings/payments#payment-link", superAdminOnly: true },
      { label: "Currency", href: "/admin/settings/payments#currency", superAdminOnly: true },
      { label: "Webhook Settings", href: "/admin/settings/payments#webhook-settings", superAdminOnly: true },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    permission: "marketing",
    items: [
      { label: "Campaigns", href: "/admin/campaigns", permission: "coupons_offers" },
      { label: "Coupons", href: "/admin/coupons", permission: "coupons_offers" },
      { label: "Banners", href: "/admin/banners", permission: "coupons_offers" },
      { label: "Notifications", href: "#", permission: "marketing" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    permission: "reports_analytics",
    items: [
      { label: "Sales", href: "#" },
      { label: "Revenue", href: "#" },
      { label: "Sellers", href: "#" },
      { label: "Products", href: "#" },
      { label: "Customers", href: "#" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    permission: "settings",
    items: [
      { label: "General Settings", href: "#" },
      { label: "Shipping", href: "#" },
      { label: "Tax / GST", href: "#" },
      { label: "Email & SMS", href: "#" },
      { label: "Security", href: "#" },
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
]

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

  // Explicit, not just implied by hasPermission's short-circuit: super_admin
  // always sees every section, full stop, regardless of anything else about
  // their account. Never make this conditional on ROLE_PERMISSIONS.
  // DEV_SHOW_ADMIN_MENU_TO_ALL (lib/dev-flags.ts): temporary, frontend-only —
  // remove this branch to restore role-based menu visibility.
  const visibleSections =
    DEV_SHOW_ADMIN_MENU_TO_ALL || role === "super_admin"
      ? adminSections
      : isAdminRole(role)
        ? adminSections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => hasPermission(role, item.permission ?? section.permission)),
            }))
            .filter((section) => section.items.length > 0)
        : []

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

      {(DEV_SHOW_ADMIN_MENU_TO_ALL ||
        staff.role === "super_admin" ||
        (isAdminRole(staff.role) && hasPermission(staff.role, "product_management"))) && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
        >
          <LayoutDashboard className="size-4 shrink-0 text-green-700" />
          Dashboard
        </Link>
      )}

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
