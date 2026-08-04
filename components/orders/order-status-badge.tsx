import { Badge } from "@/components/ui/badge"
import type { OrderStatus } from "@/types/order"

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Accepted: "outline",
  Packing: "outline",
  "Ready To Ship": "outline",
  Shipped: "default",
  "Out For Delivery": "default",
  Delivered: "default",
  Cancelled: "destructive",
  "Return Requested": "secondary",
  "Return Approved": "outline",
  "Return Rejected": "destructive",
  "Pickup Scheduled": "outline",
  "Picked Up": "outline",
  Refunded: "destructive",
  "Replacement Requested": "secondary",
  "Replacement Approved": "outline",
  "Replacement Rejected": "destructive",
  Completed: "default",
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
}
