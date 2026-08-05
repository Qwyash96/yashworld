"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { BrandMark } from "@/components/brand-mark"
import { cn } from "@/lib/utils"

/** Text-only seller navigation — no icons, no emojis. `href: "#"` marks a
 * section that isn't built yet (same convention as components/admin/admin-sidebar.tsx's
 * unbuilt items); those render muted and unclickable rather than a dead link. */
const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/seller" },
  { label: "Orders", href: "/seller/orders" },
  { label: "Products", href: "/seller/products" },
  { label: "Offers", href: "/seller/offers" },
  { label: "Advertisements", href: "/seller/marketing" },
  { label: "Shipping", href: "/seller/shipping" },
  { label: "Wallet", href: "/seller/orders#wallet" },
  { label: "Reviews", href: "#" },
  { label: "Analytics", href: "#" },
  { label: "Customers", href: "#" },
  { label: "Settings", href: "/seller/shop-profile" },
  { label: "Support", href: "/contact" },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "#" || href.includes("#")) return false
  if (href === "/seller") return pathname === "/seller"
  return pathname === href || pathname.startsWith(`${href}/`)
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
      <div className="flex h-16 items-center border-b border-gray-200 px-5">
        <BrandMark size="header" />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) =>
          item.href === "#" ? (
            <span
              key={item.label}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400"
            >
              {item.label}
              <span className="text-[10px] uppercase tracking-wide text-gray-300">Soon</span>
            </span>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, item.href)
                  ? "bg-green-700 text-white"
                  : "text-gray-700 hover:bg-green-50 hover:text-green-800",
              )}
            >
              {item.label}
            </Link>
          ),
        )}

        <div className="my-2 border-t border-gray-100" />

        {sellerUid && (
          <Link
            href={`/sellers/${sellerUid}`}
            onClick={onNavigate}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-green-50 hover:text-green-800"
          >
            View Store
          </Link>
        )}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
