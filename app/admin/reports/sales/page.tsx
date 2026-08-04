"use client"

import { BarChart3, Download } from "lucide-react"
import { useReportsData } from "@/hooks/use-reports-data"
import { DateRangePicker } from "@/components/admin/reports/date-range-picker"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { downloadCsv } from "@/lib/csv-export"
import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"

export default function SalesReportPage() {
  const { from, to, setFrom, setTo, data, error, loading } = useReportsData()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Sales Report</h1>
        </div>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>
      <p className="mt-1 text-sm text-[#444444]">Real order data for the selected date range.</p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-8 text-sm text-[#444444]">Loading...</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{data.totals.orders}</p>
              <p className="text-sm text-[#444444]">Total Orders</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{formatPrice(data.totals.revenue)}</p>
              <p className="text-sm text-[#444444]">Total Revenue</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">
                {data.totals.orders > 0 ? formatPrice(data.totals.revenue / data.totals.orders) : formatPrice(0)}
              </p>
              <p className="text-sm text-[#444444]">Average Order Value</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold text-black">{data.byProduct.length}</p>
              <p className="text-sm text-[#444444]">Distinct Products Sold</p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Orders & Revenue Over Time</h2>
            <div className="mt-4">
              <RevenueChart data={data.dailySeries} />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Daily Breakdown</h2>
              <Button size="sm" variant="outline" className="h-9" onClick={() => downloadCsv("sales-report.csv", data.dailySeries)}>
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-[#f3f5f2] text-left text-xs uppercase tracking-widest text-[#444444]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.dailySeries.map((d) => (
                    <tr key={d.date}>
                      <td className="p-3 text-black">{d.date}</td>
                      <td className="p-3 text-black">{d.orders}</td>
                      <td className="p-3 text-black">{formatPrice(d.revenue)}</td>
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
