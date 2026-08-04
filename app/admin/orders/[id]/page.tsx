"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { getOrderById, updateOrderStatus } from "@/services/order.service"
import { refundOrder } from "@/lib/admin-orders-client"
import { formatPrice } from "@/lib/products"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import type { Order, OrderStatus } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_OPTIONS: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Packing",
  "Ready To Ship",
  "Shipped",
  "Out For Delivery",
  "Delivered",
  "Cancelled",
  "Refunded",
]

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)

  function refresh() {
    getOrderById(params.id).then(setOrder)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  if (order === undefined) return null
  if (order === null) {
    return (
      <div className="p-8 text-center">
        <p className="text-black">Order not found.</p>
        <Link href="/admin/orders" className="mt-4 inline-block text-green-700 hover:underline">
          Back to Orders
        </Link>
      </div>
    )
  }

  async function handleStatusOverride(status: OrderStatus) {
    await updateOrderStatus(order!.id, status)
    toast.success("Order status updated.")
    refresh()
  }

  async function handleRefund(sellerId?: string) {
    if (!window.confirm(sellerId ? "Refund this seller's portion of the order?" : "Refund the entire order?")) return
    const result = await refundOrder(order!.id, sellerId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Refund issued.")
    refresh()
  }

  return (
    <div>
      <Link href="/admin/orders" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-[#444444]">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Select value={order.status} onValueChange={(v) => v && handleStatusOverride(v as OrderStatus)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" className="h-9" onClick={() => handleRefund()}>
            Refund Order
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Buyer & Shipping</h2>
          <p className="mt-3 text-sm text-black">{order.contactEmail}</p>
          <p className="mt-2 text-sm text-[#444444]">
            {order.shippingAddress.fullName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.phone}
          </p>
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#444444]">Subtotal</span>
              <span className="text-black">{formatPrice(order.totals.subtotal)}</span>
            </div>
            {order.totals.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#444444]">Discount</span>
                <span className="text-green-700">-{formatPrice(order.totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#444444]">Shipping</span>
              <span className="text-black">{order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-black">Total</span>
              <span className="text-black">{formatPrice(order.totals.total)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#444444]">
            {order.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"} · {order.paymentStatus}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {order.sellerOrders.map((so) => (
            <div key={so.sellerId} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-[#444444]">Seller {so.sellerId}</p>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={so.status} />
                  {so.status !== "Refunded" && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => handleRefund(so.sellerId)}>
                      Refund
                    </Button>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {so.items.map((item) => (
                  <li key={item.productId} className="flex justify-between text-[#444444]">
                    <span>{item.productId} × {item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[#444444]">
                Commission {formatPrice(so.commissionAmount)} · Payout {formatPrice(so.payoutAmount)}
                {so.payoutStatus ? ` · ${so.payoutStatus}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
