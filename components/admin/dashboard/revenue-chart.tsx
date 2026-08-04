"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatPrice } from "@/lib/products"
import type { DashboardChartPoint } from "@/types/dashboard-stats"

export function RevenueChart({ data }: { data: DashboardChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
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
          />
          <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value, name) => {
              const numeric = typeof value === "number" ? value : Number(value) || 0
              return [name === "revenue" ? formatPrice(numeric) : numeric, name === "revenue" ? "Revenue" : "Orders"]
            }}
            labelStyle={{ color: "#000" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#15803d" strokeWidth={2} fill="url(#revenueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
