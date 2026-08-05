"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Leaf, Package, ShoppingBag, Tag, Megaphone, Store, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { href: "/seller/shipping", label: "Shipping", icon: Truck },
  { href: "/seller/offers", label: "Offers", icon: Tag },
  { href: "/seller/marketing", label: "Marketing", icon: Megaphone },
  { href: "/seller/shop-profile", label: "Shop Profile", icon: Store },
]

export function SellerSidebarContent() {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-2 border-b border-gray-200 px-6">
        <Leaf className="h-7 w-7 text-green-700" />
        <span className="text-xl font-bold text-green-800">YashWorld</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-green-700 text-white shadow-sm"
                  : "text-gray-600 hover:bg-green-50 hover:text-green-800",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-gray-200 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Seller Dashboard
        </p>
      </div>
    </div>
  )
}

export function SellerSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
      <SellerSidebarContent />
    </aside>
  )
}
