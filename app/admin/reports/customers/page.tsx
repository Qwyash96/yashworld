"use client"

import Link from "next/link"
import { Users, Download } from "lucide-react"
import { useReportsData } from "@/hooks/use-reports-data"
import { DateRangePicker } from "@/components/admin/reports/date-range-picker"
import { downloadCsv } from "@/lib/csv-export"
import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"

export default function CustomersReportPage() {
  const { from, to, setFrom, setTo, data, error, loading } = useReportsData()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Customers Report</h1>
        </div>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>
      <p className="mt-1 text-sm text-[#444444]">Order count and spend per buyer for the selected date range.</p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-8 text-sm text-[#444444]">Loading...</p>}

      {data && (
        <section className="mt-6">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-9" onClick={() => downloadCsv("customers-report.csv", data.byCustomer)}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-[#f3f5f2] text-left text-xs uppercase tracking-widest text-[#444444]">
                <tr>
                  <th className="p-3">Buyer</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byCustomer.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-[#444444]">No orders in this range.</td>
                  </tr>
                )}
                {data.byCustomer.map((c) => (
                  <tr key={c.buyerId}>
                    <td className="p-3">
                      <Link href={`/admin/users/${c.buyerId}`} className="text-green-700 hover:underline">
                        {c.email}
                      </Link>
                    </td>
                    <td className="p-3 text-black">{c.orders}</td>
                    <td className="p-3 text-black">{formatPrice(c.spend)}</td>
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
