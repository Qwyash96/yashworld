"use client"

import { IndianRupee, Download } from "lucide-react"
import { useReportsData } from "@/hooks/use-reports-data"
import { DateRangePicker } from "@/components/admin/reports/date-range-picker"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { downloadCsv } from "@/lib/csv-export"
import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"

export default function RevenueReportPage() {
  const { from, to, setFrom, setTo, data, error, loading } = useReportsData()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IndianRupee className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Revenue Report</h1>
        </div>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>
      <p className="mt-1 text-sm text-[#444444]">Revenue, discounts, and shipping collected for the selected date range.</p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-8 text-sm text-[#444444]">Loading...</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{formatPrice(data.totals.revenue)}</p>
              <p className="text-sm text-[#444444]">Gross Revenue</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{formatPrice(data.totals.discount)}</p>
              <p className="text-sm text-[#444444]">Discounts Given</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{formatPrice(data.totals.shipping)}</p>
              <p className="text-sm text-[#444444]">Shipping Collected</p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Revenue Trend</h2>
            <div className="mt-4">
              <RevenueChart data={data.dailySeries} />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">By Seller</h2>
              <Button size="sm" variant="outline" className="h-9" onClick={() => downloadCsv("revenue-by-seller.csv", data.bySeller)}>
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-[#f3f5f2] text-left text-xs uppercase tracking-widest text-[#444444]">
                  <tr>
                    <th className="p-3">Seller</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Revenue</th>
                    <th className="p-3">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.bySeller.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-[#444444]">No orders in this range.</td>
                    </tr>
                  )}
                  {data.bySeller.map((s) => (
                    <tr key={s.sellerId}>
                      <td className="p-3 text-black">{s.sellerId}</td>
                      <td className="p-3 text-black">{s.orders}</td>
                      <td className="p-3 text-black">{formatPrice(s.revenue)}</td>
                      <td className="p-3 text-black">{formatPrice(s.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
