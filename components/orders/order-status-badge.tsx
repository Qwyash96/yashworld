import { Badge } from "@/components/ui/badge"
import type { OrderStatus } from "@/types/order"

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Accepted: "outline",
  "Ready To Pack": "outline",
  Packed: "outline",
  "Pickup Requested": "outline",
  "Picked Up": "outline",
  "In Transit": "default",
  "Out For Delivery": "default",
  Delivered: "default",
  Returned: "destructive",
  Cancelled: "destructive",
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
}
