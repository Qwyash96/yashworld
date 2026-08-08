"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, ChevronDown } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { SellerSidebarContent } from "@/components/seller/seller-sidebar"
import { SellerNotificationBell } from "@/components/seller/seller-notification-bell"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Persistent chrome for every /seller/** page. Desktop (lg+) gets a docked
 * left sidebar (mirrors app/admin/layout.tsx's docked-aside + mobile-Sheet
 * split); below lg the same SellerSidebarContent opens in a Sheet drawer
 * from a compact top-bar hamburger, same as before.
 *
 * Deliberately does NOT gate access itself — every page already has its own
 * useSellerGate() check with its own loading/sign-in/pending/rejected UI;
 * this only decides whether the NAV CHROME wraps around that. An unapproved
 * seller still sees their page's own full-screen message, unwrapped,
 * exactly as before.
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const gate = useSellerGate()
  const { user } = useStore()
  const [navOpen, setNavOpen] = useState(false)

  if (gate.state !== "approved") {
    return <>{children}</>
  }

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "S"

  return (
    <div className="min-h-screen bg-[#F8F8F2] lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <SellerSidebarContent />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-white px-3 sm:gap-3 sm:px-4 lg:px-6">
          <div className="lg:hidden">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                aria-label="Open seller menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-black hover:bg-gray-50"
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Seller Menu</SheetTitle>
                </SheetHeader>
                <SellerSidebarContent onNavigate={() => setNavOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          <span className="min-w-0 flex-1 truncate text-sm font-bold text-green-700 lg:hidden">IXOFLORA Seller</span>
          <span className="hidden flex-1 lg:block" />

          <SellerNotificationBell sellerId={gate.uid} />

          <Link
            href="/seller/shop-profile"
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl px-1.5 text-sm font-medium text-black transition-colors hover:bg-gray-50 sm:px-2"
          >
            <Avatar size="sm">
              {user?.photoUrl && <AvatarImage src={user.photoUrl} alt={user.name} />}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate sm:inline">{user?.name || "Profile"}</span>
            <ChevronDown className="hidden size-3.5 text-gray-400 sm:block" />
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
