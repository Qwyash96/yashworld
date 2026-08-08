"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatPrice } from "@/lib/products"

export interface SalesTrendPoint {
  date: string
  revenue: number
}

/** Same recharts pattern as components/admin/dashboard/revenue-chart.tsx
 * (green area chart, dynamic-imported with ssr:false by the caller) — kept
 * as a separate component since this one plots a single seller's own
 * revenue, not the platform-wide figure. */
export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const hasData = data.some((d) => d.revenue > 0)

  if (!hasData) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
        <p className="font-medium text-gray-600">No sales yet in this period</p>
        <p className="text-xs">Your sales trend will appear here once orders start coming in.</p>
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sellerSalesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803d" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#15803d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={(value) => [formatPrice(typeof value === "number" ? value : Number(value) || 0), "Sales"]} labelStyle={{ color: "#000" }} />
          <Area type="monotone" dataKey="revenue" stroke="#15803d" strokeWidth={2} fill="url(#sellerSalesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
