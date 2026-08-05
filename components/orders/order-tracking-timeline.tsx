import { CheckCircle2, Circle, XCircle } from "lucide-react"
import { ORDER_FULFILMENT_SEQUENCE } from "@/types/order-lifecycle"
import type { OrderStatus, OrderTimelineEvent } from "@/types/order"
import { cn } from "@/lib/utils"

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

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
        const done = i <= currentIndex
        const isLast = i === ORDER_FULFILMENT_SEQUENCE.length - 1
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              {done ? <CheckCircle2 className="size-5 shrink-0 text-green-600" /> : <Circle className="size-5 shrink-0 text-gray-300" />}
              {!isLast && <div className={cn("min-h-6 w-px flex-1", i < currentIndex ? "bg-green-600" : "bg-gray-200")} />}
            </div>
            <div className="pb-4">
              <p className={cn("text-sm font-medium", done ? "text-black" : "text-gray-400")}>{step}</p>
              {event && <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>}
              {event?.note && <p className="mt-0.5 text-xs text-muted-foreground">{event.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
