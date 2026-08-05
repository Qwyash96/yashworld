"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Package, Search, Eye, Trash2, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import {
  getAllProducts,
  approveProduct,
  rejectProduct,
  deleteProduct,
} from "@/services/product.service"
import { getCoverImageUrl } from "@/lib/product-images"
import { ProductImage } from "@/components/product-image"
import { formatPrice } from "@/lib/products"
import { Price } from "@/components/price"
import type { Product, ProductStatus } from "@/types/product"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const statusTabs: { key: ProductStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

const statusStyles: Record<ProductStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-gray-200 text-gray-700",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function AdminProductsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialStatus = (searchParams.get("status") as ProductStatus | null) ?? "all"

  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">(initialStatus)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  function refresh() {
    getAllProducts().then(setProducts)
  }

  useEffect(() => {
    refresh()
  }, [])

  function selectStatusTab(tab: ProductStatus | "all") {
    setStatusFilter(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "all") params.delete("status")
    else params.set("status", tab)
    router.replace(`/admin/products${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoryId))),
    [products]
  )

  const counters = useMemo(
    () => ({
      pending: products.filter((p) => p.status === "pending").length,
      approved: products.filter((p) => p.status === "approved").length,
      rejected: products.filter((p) => p.status === "rejected").length,
    }),
    [products]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      if (categoryFilter !== "all" && p.categoryId !== categoryFilter) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.sellerId.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [products, statusFilter, categoryFilter, searchQuery])

  async function approve(product: Product) {
    if (!window.confirm(`Approve "${product.name}"? It will become visible across the site.`)) {
      return
    }
    await approveProduct(product.id)
    toast.success(`${product.name} approved`)
    refresh()
  }

  async function confirmReject() {
    if (!rejectingId) return
    await rejectProduct(rejectingId, rejectReason.trim() || undefined)
    toast.success("Product rejected")
    setRejectingId(null)
    setRejectReason("")
    refresh()
  }

  async function remove(product: Product) {
    if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      await deleteProduct(product.id)
      toast.success("Product deleted")
      refresh()
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Package className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Product Management</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Review products submitted by sellers before they go live.
      </p>

      {/* Counters */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-[#f3f5f2] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
            Pending Products
          </p>
          <p className="mt-2 text-2xl font-bold text-black">{counters.pending}</p>
        </div>
        <div className="rounded-2xl border border-border bg-[#f3f5f2] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
            Approved Products
          </p>
          <p className="mt-2 text-2xl font-bold text-black">{counters.approved}</p>
        </div>
        <div className="rounded-2xl border border-border bg-[#f3f5f2] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
            Rejected Products
          </p>
          <p className="mt-2 text-2xl font-bold text-black">{counters.rejected}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-green-700" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name or seller ID..."
            className="h-11 w-full rounded-lg border border-border bg-white pl-10 pr-3 text-sm text-black outline-none focus:border-primary"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="h-11 w-full sm:w-56">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => selectStatusTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-green-600 text-white"
                : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Product cards */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-border bg-[#f3f5f2] p-10 text-center text-sm text-[#444444]">
            No products match this filter yet.
          </p>
        ) : (
          filtered.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
            >
              <div className="relative h-44">
                <ProductImage
                  src={getCoverImageUrl(product.images)}
                  alt={product.name}
                  className="absolute inset-0"
                  padding="md"
                />
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[product.status]}`}
                >
                  {product.status}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <h3 className="text-base font-bold text-black line-clamp-1">{product.name}</h3>
                <p className="text-xs text-[#444444]">
                  Seller ID: <span className="text-[10px]">{product.sellerId}</span>
                </p>
                <p className="text-xs text-[#444444] capitalize">Category: {product.categoryId}</p>
                <p className="line-clamp-2 text-xs text-[#444444]">{product.description}</p>

                <div className="mt-1 flex items-center justify-between text-sm">
                  <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
                  <span className="text-xs text-[#444444]">Stock: {product.stock}</span>
                </div>

                <p className="text-xs text-[#444444]">
                  Submitted: {formatDate(product.createdAt)}
                </p>

                {product.status === "rejected" && product.rejectionReason && (
                  <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    Reason: {product.rejectionReason}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => approve(product)}
                  disabled={product.status === "approved"}
                >
                  <CheckCircle2 className="size-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setRejectingId(product.id)
                    setRejectReason("")
                  }}
                  disabled={product.status === "rejected"}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => setViewingProduct(product)}
                >
                  <Eye className="size-4" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9"
                  onClick={() => remove(product)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>

              {rejectingId === product.id && (
                <div className="border-t border-border bg-[#f3f5f2] p-3">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="h-20 w-full rounded-lg border border-border bg-white p-2 text-sm text-black outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-8" onClick={confirmReject}>
                      Confirm Rejection
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setRejectingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* View Details */}
      <Sheet open={!!viewingProduct} onOpenChange={(open) => !open && setViewingProduct(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Product Details</SheetTitle>
          </SheetHeader>
          {viewingProduct && (
            <div className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {viewingProduct.images.length > 0 ? (
                  viewingProduct.images.map((img) => (
                    <div
                      key={img.url}
                      className="relative h-24 overflow-hidden rounded-lg"
                    >
                      <ProductImage src={img.url} alt="" className="absolute inset-0" padding="xs" />
                      {img.isCover && (
                        <span className="absolute left-1 top-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Cover
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="col-span-3 text-sm text-[#444444]">No images uploaded.</p>
                )}
              </div>

              <DetailRow label="Product Name" value={viewingProduct.name} />
              <DetailRow label="Seller ID" value={viewingProduct.sellerId} />
              <DetailRow label="Category" value={viewingProduct.categoryId} />
              <DetailRow label="Description" value={viewingProduct.description} />
              <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <span className="text-[#444444]">Price</span>
                <Price price={viewingProduct.price} originalPrice={viewingProduct.originalPrice} size="sm" showSavings />
              </div>
              <DetailRow label="Stock" value={String(viewingProduct.stock)} />
              <DetailRow label="Light" value={viewingProduct.plantAttrs.light} />
              <DetailRow
                label="Watering"
                value={`Every ${viewingProduct.plantAttrs.wateringFrequencyDays} day(s)`}
              />
              <DetailRow label="Difficulty" value={viewingProduct.plantAttrs.difficulty} />
              <DetailRow label="Size" value={viewingProduct.plantAttrs.size} />
              <DetailRow label="Pet Safe" value={viewingProduct.plantAttrs.petSafe ? "Yes" : "No"} />
              <DetailRow label="Indoor" value={viewingProduct.plantAttrs.indoor ? "Yes" : "No"} />
              <DetailRow label="Submitted" value={formatDate(viewingProduct.createdAt)} />
              <DetailRow label="Status" value={viewingProduct.status} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#444444]">{label}</span>
      <span className="font-medium text-black">{value}</span>
    </div>
  )
}
