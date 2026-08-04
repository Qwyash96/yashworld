"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { LayoutDashboard } from "lucide-react"
import { getPendingProducts, approveProduct, rejectProduct } from "@/services/product.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { getVisibleAdminSections } from "@/components/admin/admin-sidebar"
import { hasPermission, isAdminRole } from "@/lib/admin-roles"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/**
 * The dashboard root ("/admin") — every admin login lands here (see
 * app/admin/login/page.tsx), for every role, so it must never be a hard
 * wall. Product Moderation only makes sense for roles with
 * product_management; everyone else instead sees a summary of the modules
 * their role actually has access to, built from the exact same
 * getVisibleAdminSections the sidebar uses, so this can never claim access
 * to something the sidebar (and the route guard) would then deny.
 */
export default function AdminDashboardPage() {
  const admin = useAdminAuth()
  const canModerateProducts =
    DEV_SHOW_ADMIN_MENU_TO_ALL || admin.role === "super_admin" || (isAdminRole(admin.role) && hasPermission(admin.role, "product_management"))

  if (!canModerateProducts) {
    return <RoleLandingPage />
  }

  return <ProductModerationPanel />
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
      <div className="flex items-center gap-3">
        <LayoutDashboard className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Welcome, {admin.name}</h1>
      </div>
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Product Moderation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Products awaiting review before they appear in the store.
      </p>

      {products === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No products pending review.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  ₹{product.price} · Seller {product.sellerId}
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
    </div>
  )
}
