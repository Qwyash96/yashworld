"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Menu, Package, Pencil, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getProductsBySeller, deleteProduct } from "@/services/product.service"
import { getOrdersBySeller } from "@/services/order.service"
import { getCoverImageUrl } from "@/lib/product-images"
import { formatPrice } from "@/lib/products"
import { Price } from "@/components/price"
import type { Product, ProductStatus } from "@/types/product"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SellerSidebar, SellerSidebarContent } from "@/components/seller/seller-sidebar"
import { StatCard } from "@/components/seller/stat-card"

const STATUS_STYLES: Record<ProductStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

export default function SellerProductsPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [products, setProducts] = useState<Product[] | null>(null)
  const [orderStats, setOrderStats] = useState<{ count: number; revenue: number } | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!sellerUid) return
    getProductsBySeller(sellerUid).then(setProducts)
    // Read-only usage of the existing Orders service, purely to power the
    // analytics cards below — nothing in the Orders feature itself changes.
    getOrdersBySeller(sellerUid).then((orders) => {
      const mine = orders
        .map((o) => o.sellerOrders.find((so) => so.sellerId === sellerUid))
        .filter((so): so is NonNullable<typeof so> => so !== undefined)
      const revenue = mine
        .filter((so) => so.status !== "Cancelled")
        .reduce((sum, so) => sum + so.items.reduce((s, i) => s + i.price * i.quantity, 0), 0)
      setOrderStats({ count: mine.length, revenue })
    })
  }, [sellerUid])

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return
    await deleteProduct(id)
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  // Transient auth/role resolution — a skeleton instead of a blocking "Loading..." message.
  if (gate.state === "loading") {
    return (
      <div className="flex min-h-screen bg-[#F8F8F2]">
        <div className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block" />
        <div className="flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-gray-200" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-gray-200" />
        </div>
      </div>
    )
  }

  // Terminal, non-approved states — a real empty-state card, not a loading screen.
  if (gate.state !== "approved") {
    const content =
      gate.state === "signed-out"
        ? {
            title: "Sign In Required",
            message: "Sign in to access your seller dashboard.",
            cta: { href: "/login", label: "Sign In" },
          }
        : gate.state === "not-applied"
          ? {
              title: "Become a Seller",
              message: "You haven't applied to become a seller yet.",
              cta: null,
            }
          : gate.state === "pending"
            ? {
                title: "Application Pending",
                message: "Your seller application is awaiting admin approval.",
                cta: null,
              }
            : {
                title: "Application Rejected",
                message: gate.reason || "Your seller application was rejected. Please review and resubmit.",
                cta: { href: "/sell/register", label: "Edit & Resubmit" },
              }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8F2] px-4">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
            <Package className="h-7 w-7 text-green-700" />
          </div>
          <h1 className="mt-6 text-xl font-bold text-gray-900">{content.title}</h1>
          <p className="mt-2 text-sm text-gray-500">{content.message}</p>
          {content.cta && (
            <Link
              href={content.cta.href}
              className="mt-6 inline-block rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              {content.cta.label}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F8F8F2]">
      <SellerSidebar />

      <div className="min-w-0 flex-1">
        {/* Dashboard header */}
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="rounded-xl border border-gray-200 p-2 text-gray-600 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Seller Menu</SheetTitle>
                </SheetHeader>
                <SellerSidebarContent />
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">My Products</h1>
              <p className="text-sm text-gray-500">Manage your plant listings</p>
            </div>
          </div>

          <Link
            href="/seller/products/new"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 sm:px-6 sm:py-3"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Link>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-10">
          {/* Analytics cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StatCard
              icon={Package}
              label="Products"
              value={products === null ? "—" : products.length}
            />
            <StatCard
              icon={ShoppingBag}
              label="Orders"
              value={orderStats === null ? "—" : orderStats.count}
            />
            <StatCard
              icon={Wallet}
              label="Revenue"
              value={orderStats === null ? "—" : formatPrice(orderStats.revenue)}
            />
          </div>

          {/* Product table */}
          <div className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            {products === null ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">You haven&apos;t added any products yet.</p>
                <Link
                  href="/seller/products/new"
                  className="mt-4 inline-block rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
                >
                  Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Stock</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => (
                      <tr key={product.id} className="transition hover:bg-green-50/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                              <Image
                                src={getCoverImageUrl(product.images) || "/placeholder.svg"}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <span className="font-medium text-gray-900">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{product.categoryId}</td>
                        <td className="px-6 py-4 text-gray-700">
                          <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
                        </td>
                        <td className="px-6 py-4 text-gray-700">{product.stock}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[product.status]}`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/seller/products/${product.id}/edit`}
                              aria-label="Edit product"
                              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-green-600 hover:text-green-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(product.id)}
                              aria-label="Delete product"
                              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
