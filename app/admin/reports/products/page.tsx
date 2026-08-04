"use client"

import Link from "next/link"
import { Package, Download } from "lucide-react"
import { useReportsData } from "@/hooks/use-reports-data"
import { DateRangePicker } from "@/components/admin/reports/date-range-picker"
import { downloadCsv } from "@/lib/csv-export"
import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"

export default function ProductsReportPage() {
  const { from, to, setFrom, setTo, data, error, loading } = useReportsData()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Package className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Products Report</h1>
        </div>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>
      <p className="mt-1 text-sm text-[#444444]">Units sold and revenue per product for the selected date range.</p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-8 text-sm text-[#444444]">Loading...</p>}

      {data && (
        <section className="mt-6">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-9" onClick={() => downloadCsv("products-report.csv", data.byProduct)}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-[#f3f5f2] text-left text-xs uppercase tracking-widest text-[#444444]">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Units Sold</th>
                  <th className="p-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byProduct.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-[#444444]">No orders in this range.</td>
                  </tr>
                )}
                {data.byProduct.map((p) => (
                  <tr key={p.productId}>
                    <td className="p-3">
                      <Link href={`/products/${p.productId}`} className="text-green-700 hover:underline">
                        {p.productName}
                      </Link>
                    </td>
                    <td className="p-3 text-black">{p.units}</td>
                    <td className="p-3 text-black">{formatPrice(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
