import { CheckCircle2, Circle, XCircle } from "lucide-react"
import { ORDER_FULFILMENT_SEQUENCE } from "@/types/order-lifecycle"
import type { OrderStatus, OrderTimelineEvent } from "@/types/order"
import { cn } from "@/lib/utils"

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

// Display-only relabeling — "Pending" is the real OrderStatus value the
// moment an order lands with a seller; "Order Received" reads better as the
// first step of a fulfilment timeline.
const STEP_LABELS: Partial<Record<OrderStatus, string>> = { Pending: "Order Received" }

/** Vertical stepper through the real fulfilment pipeline (types/order-lifecycle.ts's
 * ORDER_FULFILMENT_SEQUENCE), timestamped from sellerOrder.timeline — the
 * same array every status transition appends to, including a live Shiprocket
 * sync (see app/api/seller/orders/[id]/track), so this reads as one honest
 * history regardless of whether a step was manual or courier-driven. */
export function OrderTrackingTimeline({ status, timeline }: { status: OrderStatus; timeline?: OrderTimelineEvent[] }) {
  const events = timeline ?? []
  const eventByStatus = new Map(events.map((e) => [e.status, e]))

  if (status === "Cancelled" || status === "Returned") {
    const terminal = eventByStatus.get(status)
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3">
        <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-semibold text-red-700">{status}</p>
          {terminal && <p className="text-xs text-red-600">{formatDateTime(terminal.at)}</p>}
          {terminal?.note && <p className="mt-1 text-xs text-red-600">{terminal.note}</p>}
        </div>
      </div>
    )
  }

  const currentIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(status)

  return (
    <ol className="flex flex-col">
      {ORDER_FULFILMENT_SEQUENCE.map((step, i) => {
        const event = eventByStatus.get(step)
        const done = i < currentIndex
        const isCurrent = i === currentIndex
        const isLast = i === ORDER_FULFILMENT_SEQUENCE.length - 1
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              {done || isCurrent ? (
                <CheckCircle2 className={cn("size-5 shrink-0", isCurrent ? "text-green-600" : "text-green-600/70")} />
              ) : (
                <Circle className="size-5 shrink-0 text-gray-300" />
              )}
              {!isLast && <div className={cn("min-h-6 w-px flex-1", i < currentIndex ? "bg-green-600" : "bg-gray-200")} />}
            </div>
            <div className="pb-4">
              <p
                className={cn(
                  "text-sm font-medium",
                  isCurrent ? "font-bold text-green-700" : done ? "text-black" : "text-gray-400",
                )}
              >
                {STEP_LABELS[step] ?? step}
                {isCurrent && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                    Current
                  </span>
                )}
              </p>
              {event && <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>}
              {event?.note && <p className="mt-0.5 text-xs text-muted-foreground">{event.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
