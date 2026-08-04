"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import {
  Menu,
  User,
  Home,
  LayoutGrid,
  Tag,
  Sparkles,
  Phone,
  HelpCircle,
  LifeBuoy,
  Package,
  Heart,
  ShoppingBag,
  ShoppingCart,
  GitCompareArrows,
  Leaf,
  type LucideIcon,
} from "lucide-react"
import { useStore } from "@/components/store-provider"
import { getOrdersByBuyer } from "@/services/order.service"
import { getPublicSiteBranding } from "@/services/site-settings.service"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import { HeaderSearchBar } from "@/components/marketplace/header-search-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type MenuItem = { label: string; href: string; icon: LucideIcon }
type MenuGroup = { label: string; emoji: string; items: MenuItem[] }

const shopGroup: MenuGroup = {
  label: "Shop",
  emoji: "🌿",
  items: [
    { label: "Home", href: "/", icon: Home },
    { label: "Shop All", href: "/products", icon: ShoppingBag },
    { label: "Categories", href: "/categories", icon: LayoutGrid },
    { label: "Compare", href: "/compare", icon: GitCompareArrows },
    { label: "Today's Deals", href: "/#todays-deals", icon: Tag },
    { label: "New Arrivals", href: "/#new-arrivals", icon: Sparkles },
  ],
}

const supportGroup: MenuGroup = {
  label: "Support",
  emoji: "📞",
  items: [
    { label: "Contact", href: "/contact", icon: Phone },
    { label: "FAQ", href: "#", icon: HelpCircle },
    { label: "Help Center", href: "#", icon: LifeBuoy },
  ],
}

/** Small, sticky, ~64px — logo, a compact search bar, and icon-only quick
 * actions, all in one row on every breakpoint (mobile-first premium app
 * shape, not a stacked/oversized header). */
export function SiteHeader() {
  const { user, wishlist, cartCount } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    getPublicSiteBranding().then((b) => setLogoUrl(b.logoUrl))
  }, [])

  useEffect(() => {
    if (!user) {
      setPendingOrders(0)
      return
    }
    let cancelled = false
    const pendingStatuses = new Set([
      "Pending",
      "Accepted",
      "Ready To Pack",
      "Packed",
      "Pickup Requested",
      "Picked Up",
      "In Transit",
      "Out For Delivery",
    ])
    getOrdersByBuyer(user.uid).then((orders) => {
      if (cancelled) return
      setPendingOrders(orders.filter((o) => pendingStatuses.has(o.status)).length)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const quickActions: { label: string; href: string; icon: LucideIcon; count: number }[] = [
    { label: "Wishlist", href: "/wishlist", icon: Heart, count: wishlist.length },
    { label: "Cart", href: "/cart", icon: ShoppingCart, count: cartCount },
    { label: "Orders", href: "/orders", icon: Package, count: pendingOrders },
    { label: "Profile", href: "/profile", icon: User, count: 0 },
  ]

  function renderFlatGroup(group: MenuGroup) {
    return (
      <div key={group.label}>
        <p className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-widest text-[#444444]">
          <span>{group.emoji}</span>
          {group.label}
        </p>
        <div className="flex flex-col gap-1">
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
              >
                <Icon className="size-4 shrink-0 text-green-700" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        {/* Hamburger menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Open menu" className="shrink-0">
                <Menu className="size-5 text-green-700" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-80 max-w-[85vw] overflow-y-auto p-0">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="text-xl font-bold text-green-700">YashWorld</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-6 p-4">
              {renderFlatGroup(shopGroup)}

              {/* Seller */}
              <Link
                href="/sell"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
              >
                <span>👤</span>
                Become a Seller
              </Link>

              {/* Admin — DEV_SHOW_ADMIN_MENU_TO_ALL (lib/dev-flags.ts): temporary,
                  shown to any logged-in user; ties to the same flag as the
                  /admin menu itself so both revert together. */}
              {user && DEV_SHOW_ADMIN_MENU_TO_ALL && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-green-50 hover:text-green-700"
                >
                  <span>🛠</span>
                  Admin
                </Link>
              )}

              {renderFlatGroup(supportGroup)}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo — a custom uploaded logo (Admin -> Settings -> Branding) takes
            over here when set; otherwise the default Leaf+text lockup. */}
        <Link href="/" className="flex shrink-0 items-center gap-1 text-lg font-bold text-green-700 sm:text-xl">
          {logoUrl ? (
            <span className="relative block h-7 w-24 shrink-0 sm:h-8 sm:w-28">
              <Image src={logoUrl} alt="YashWorld" fill className="object-contain object-left" priority />
            </span>
          ) : (
            <>
              <Leaf className="size-5 shrink-0" />
              <span className="hidden sm:inline">YashWorld</span>
            </>
          )}
        </Link>

        {/* Search */}
        <div className="min-w-0 flex-1">
          <HeaderSearchBar />
        </div>

        {/* Quick action icons — icon-only at every breakpoint, keeps the row compact */}
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon
            const showPhoto = action.label === "Profile" && user?.photoUrl
            return (
              <Link
                key={action.label}
                href={action.href}
                aria-label={action.label}
                className="group relative rounded-xl p-2 transition-colors hover:bg-green-50 sm:p-2.5"
              >
                {showPhoto ? (
                  <span className="relative block size-5 overflow-hidden rounded-full ring-1 ring-green-200 transition-transform group-hover:scale-110">
                    <Image src={user.photoUrl!} alt="Profile" fill className="object-cover" />
                  </span>
                ) : (
                  <Icon className="size-5 text-green-700 transition-transform group-hover:scale-110" />
                )}
                {action.count > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
                    {action.count}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
