"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BarChart3 } from "lucide-react"
import { fetchFinanceDashboard, type FinanceDashboardData, type FinanceDashboardFilters } from "@/lib/admin-finance-client"
import { formatPrice } from "@/lib/products"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const TILES: { key: keyof FinanceDashboardData; label: string; kind: "money" | "count" }[] = [
  { key: "totalSales", label: "Total Sales", kind: "money" },
  { key: "totalRefunds", label: "Total Refunds", kind: "money" },
  { key: "pendingRefunds", label: "Pending Refunds", kind: "count" },
  { key: "completedRefunds", label: "Completed Refunds", kind: "count" },
  { key: "sellerPayables", label: "Seller Payables", kind: "money" },
  { key: "platformEarnings", label: "Platform Earnings", kind: "money" },
  { key: "charges", label: "Charges", kind: "money" },
  { key: "credits", label: "Credits", kind: "money" },
  { key: "adjustments", label: "Adjustments", kind: "count" },
]

export default function AdminFinanceDashboardPage() {
  const [data, setData] = useState<FinanceDashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FinanceDashboardFilters>({})

  function load() {
    setLoading(true)
    fetchFinanceDashboard(filters).then((result) => {
      setLoading(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setData(result.data)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3">
        <BarChart3 className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Finance Dashboard</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Sales, refunds, payables, and adjustments. See also{" "}
        <Link href="/admin/finance/adjustments" className="text-green-700 underline underline-offset-4">
          Adjustments
        </Link>{" "}
        and{" "}
        <Link href="/admin/refunds" className="text-green-700 underline underline-offset-4">
          Return/Refund
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" className="h-9 w-40" value={filters.from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" className="h-9 w-40" value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sellerId">Seller ID</Label>
          <Input id="sellerId" className="h-9 w-44" value={filters.sellerId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, sellerId: e.target.value || undefined }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buyerId">Buyer ID</Label>
          <Input id="buyerId" className="h-9 w-44" value={filters.buyerId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, buyerId: e.target.value || undefined }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentMethod">Payment Method</Label>
          <Input
            id="paymentMethod"
            className="h-9 w-44"
            placeholder="cod, razorpay, ..."
            value={filters.paymentMethod ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value || undefined }))}
          />
        </div>
        <Button size="sm" className="h-9" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Apply Filters"}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {TILES.map((tile) => (
          <div key={tile.key} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#888888]">{tile.label}</p>
            <p className="mt-2 text-2xl font-bold text-black">
              {data ? (tile.kind === "money" ? formatPrice(data[tile.key]) : data[tile.key]) : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
