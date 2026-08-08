"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Wallet,
  Users,
  Megaphone,
  BarChart3,
  UserCircle,
  HelpCircle,
  Settings,
  LogOut,
  Store,
  type LucideIcon,
} from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { BrandMark } from "@/components/brand-mark"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Primary store-management sections. `href: "#"` marks a section that
 * isn't built yet (same convention as components/admin/admin-sidebar.tsx's
 * unbuilt items) — those render muted and unclickable with a "Soon" tag
 * rather than a dead link. Existing routes are reused as-is; only labels
 * changed to match the requested nav ("Products" -> "Catalog", "Wallet" ->
 * "Payments", "Advertisements" -> "Marketing") — no route was renamed or moved. */
const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/seller", icon: LayoutDashboard },
  { label: "Orders", href: "/seller/orders", icon: ShoppingBag },
  { label: "Catalog", href: "/seller/products", icon: Boxes },
  { label: "Payments", href: "/seller/orders#wallet", icon: Wallet },
  { label: "Customers", href: "#", icon: Users },
  { label: "Marketing", href: "/seller/marketing", icon: Megaphone },
  { label: "Reports", href: "#", icon: BarChart3 },
]

const SECONDARY_NAV: NavItem[] = [
  { label: "Account", href: "/seller/shop-profile", icon: UserCircle },
  { label: "Help Center", href: "/contact", icon: HelpCircle },
  { label: "Settings", href: "/seller/shop-profile", icon: Settings },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "#" || href.includes("#")) return false
  if (href === "/seller") return pathname === "/seller"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  if (item.href === "#") {
    return (
      <span className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400">
        <span className="flex items-center gap-3">
          <item.icon className="size-[18px] shrink-0" />
          {item.label}
        </span>
        <span className="text-[10px] tracking-wide text-gray-300 uppercase">Soon</span>
      </span>
    )
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-green-50 text-green-800" : "text-gray-600 hover:bg-green-50 hover:text-green-800",
      )}
    >
      <item.icon className={cn("size-[18px] shrink-0", active ? "text-green-700" : "text-gray-400")} />
      {item.label}
    </Link>
  )
}

export function SellerSidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const gate = useSellerGate()
  const { logout } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-start gap-0.5 border-b border-border px-5 py-5">
        <BrandMark size="header" />
        <p className="mt-1 text-[11px] text-gray-400">Grow Green, Live Fresh</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
        ))}

        <div className="my-2 border-t border-border" />

        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
        ))}

        {sellerUid && (
          <Link
            href={`/sellers/${sellerUid}`}
            onClick={onNavigate}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-green-50 hover:text-green-800"
          >
            <Store className="size-[18px] shrink-0 text-gray-400" />
            View Store
          </Link>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="size-[18px] shrink-0" />
          Logout
        </button>
      </div>
    </div>
  )
}
