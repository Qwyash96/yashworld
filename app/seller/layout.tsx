"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { SellerSidebarContent } from "@/components/seller/seller-sidebar"
import { SellerNotificationBell } from "@/components/seller/seller-notification-bell"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/**
 * Persistent chrome for every /seller/** page — a top bar with a single ☰
 * that opens/closes a left-side nav drawer. The sidebar is hidden by
 * default and slides in on demand, on every screen size (no permanently
 * docked desktop aside) — this replaces the old always-visible
 * desktop <aside>. Mirrors app/admin/layout.tsx's pattern in spirit, but
 * uses one Sheet for both mobile and desktop instead of a
 * drawer-on-mobile / collapsing-width-on-desktop split.
 *
 * Deliberately does NOT gate access itself — every page already has its
 * own useSellerGate() check with its own loading/sign-in/pending/rejected
 * UI; this only decides whether the NAV CHROME wraps around that. An
 * unapproved seller still sees their page's own full-screen message,
 * unwrapped, exactly as before.
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const gate = useSellerGate()
  const [navOpen, setNavOpen] = useState(false)

  if (gate.state !== "approved") {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#F8F8F2]">
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-3 sm:gap-3 sm:px-4">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger aria-label="Open seller menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-black hover:bg-gray-50">
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Seller Menu</SheetTitle>
            </SheetHeader>
            <SellerSidebarContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <span className="flex-1 truncate text-sm font-bold text-green-700">IXOFLORA Seller</span>

        <SellerNotificationBell sellerId={gate.uid} />
        <Link
          href="/seller/shop-profile"
          className="flex h-10 shrink-0 items-center rounded-xl px-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-50 sm:px-3"
        >
          Profile
        </Link>
      </div>

      {children}
    </div>
  )
}
