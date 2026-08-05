"use client"

import { usePathname } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CompareTray } from "@/components/compare-tray"

/**
 * /admin and /seller each own their own navigation (AdminSidebar via
 * app/admin/layout.tsx; the seller nav drawer via app/seller/layout.tsx) —
 * the public shop header/footer must never stack on top of those. This is a
 * single route-driven switch, not a per-page opt-out: any new page under
 * either prefix is automatically chrome-less with no extra work.
 */
const CHROME_LESS_PREFIXES = ["/admin", "/seller"]

function isChromeLess(pathname: string): boolean {
  return CHROME_LESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isChromeLess(pathname)) {
    return <main className="flex-1">{children}</main>
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CompareTray />
    </>
  )
}
