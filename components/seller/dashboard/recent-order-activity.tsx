import Link from "next/link"
import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/types/order"

export interface RecentActivityRow {
  orderId: string
  /** The sequential ORDnnnn number (lib/sequential-id.ts) — undefined only
   * for an order created before that field existed, in which case the
   * truncated orderId is shown instead. */
  orderNumber?: string
  customerName: string
  productName: string
  status: OrderStatus
}

// Translates the app's real, more granular OrderStatus onto the reference
// design's 3-color scheme (green = shipped/delivered, amber = still
// processing, red = cancelled/returned) rather than inventing a 4th color.
const STATUS_TONE: Record<OrderStatus, "green" | "amber" | "red"> = {
  Pending: "amber",
  Accepted: "amber",
  "Ready To Pack": "amber",
  Packed: "amber",
  "Pickup Requested": "amber",
  "Picked Up": "green",
  "In Transit": "green",
  "Out For Delivery": "green",
  Delivered: "green",
  Returned: "red",
  Cancelled: "red",
}

const TONE_CLASSES = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
} as const

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", TONE_CLASSES[STATUS_TONE[status]])}>
      {status}
    </span>
  )
}

export function RecentOrderActivity({ rows }: { rows: RecentActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
        <p className="font-medium text-gray-600">No orders yet</p>
        <p className="text-xs">Your recent orders will show up here.</p>
      </div>
    )
  }

  // Real browser testing showed two failed approaches before this one:
  // (1) a min-w-[420px] table inside overflow-x-auto let Status silently
  // scroll out of view on medium-width desktop cards (~330-380px, common
  // at the 60/40 chart/table split around 1280px) with no visible scroll
  // affordance; (2) table-fixed percentage columns clipped longer real
  // status words ("Out For Delivery", "Pickup Requested") since a
  // whitespace-nowrap pill doesn't shrink to fit a fixed track. This
  // version lets the table size naturally — Order ID/Status are never
  // truncated (both are short-to-moderate, bounded real content), Customer/
  // Product get tight truncation so the common case (short-to-medium
  // status words) always fits with no scrolling; overflow-x-auto remains
  // only as a safety net for the rare longest status text in a very narrow
  // card, where a native scrollbar is still discoverable rather than
  // content silently disappearing.
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-gray-500">
            <th className="py-2 pr-2 font-medium">Order ID</th>
            <th className="py-2 pr-2 font-medium">Customer</th>
            <th className="py-2 pr-2 font-medium">Product</th>
            <th className="py-2 pl-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orderId} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-2 whitespace-nowrap">
                <Link href={`/seller/orders/${row.orderId}`} className="font-medium text-gray-900 hover:text-green-700 hover:underline">
                  #{row.orderNumber ?? row.orderId.slice(0, 8)}
                </Link>
              </td>
              <td className="max-w-[70px] truncate py-2.5 pr-2 text-gray-700">{row.customerName}</td>
              <td className="max-w-[70px] truncate py-2.5 pr-2 text-gray-700">{row.productName}</td>
              <td className="py-2.5 pl-2 text-right">
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
