"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { getOrderById } from "@/services/order.service"
import { formatPrice } from "@/lib/products"
import type { Order } from "@/types/order"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { Separator } from "@/components/ui/separator"
import type { DiscountSource } from "@/types/order"

const DISCOUNT_SOURCE_LABELS: Partial<Record<DiscountSource, string>> = {
  scheduled_offer: "Scheduled Offer",
  campaign: "Campaign",
  seller_coupon: "Coupon",
}

export default function OrderDetailPage() {
  const { user, getProductById } = useStore()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const confirmed = searchParams.get("confirmed") === "1"
  const [order, setOrder] = useState<Order | null | "loading">("loading")

  useEffect(() => {
    getOrderById(params.id).then(setOrder)
  }, [params.id])

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-4">Sign in to view this order.</p>
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </div>
    )
  }
  if (order === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-16">Loading...</div>
  }
  if (!order || order.buyerId !== user.uid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-4">Order not found.</p>
        <Link href="/orders" className="underline underline-offset-4">
          Back to orders
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {confirmed && (
        <div className="mb-8 flex items-center gap-3 rounded-md border border-green-600/30 bg-green-50 p-4 text-green-800">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-sm font-medium">Order confirmed — thank you for shopping with YashWorld!</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Order #{order.id.slice(0, 8)}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Placed {new Date(order.createdAt).toLocaleString()}
      </p>

      <Separator className="my-6" />

      <h2 className="font-medium">Shipping Address</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {order.shippingAddress.fullName}
        <br />
        {order.shippingAddress.line1}
        {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
        <br />
        {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
        {order.shippingAddress.postalCode}
        <br />
        {order.shippingAddress.phone}
      </p>

      <Separator className="my-6" />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Shipping</p>
          <p className="mt-1">{order.shippingMethod === "express" ? "Express" : "Standard"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Payment</p>
          <p className="mt-1">
            {order.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"} ·{" "}
            {order.paymentStatus}
          </p>
        </div>
      </div>

      <Separator className="my-6" />

      <h2 className="font-medium">Items</h2>
      <div className="mt-4 space-y-6">
        {order.sellerOrders.map((sellerOrder) => (
          <div key={sellerOrder.sellerId} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Sold by {sellerOrder.sellerId === "yashworld" ? "YashWorld" : sellerOrder.sellerId}
              </p>
              <OrderStatusBadge status={sellerOrder.status} />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {sellerOrder.items.map((item) => {
                const product = getProductById(item.productId)
                const sourceLabel = item.discountSource ? DISCOUNT_SOURCE_LABELS[item.discountSource] : undefined
                return (
                  <li key={item.productId} className="flex justify-between">
                    <span>
                      {product?.name ?? item.productId} × {item.quantity}
                      {sourceLabel && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          {sourceLabel}
                          {item.couponCode ? ` · ${item.couponCode}` : ""}
                        </span>
                      )}
                    </span>
                    <span>
                      {item.originalPrice !== undefined && item.originalPrice > item.price && (
                        <span className="mr-2 text-xs text-muted-foreground line-through">
                          {formatPrice(item.originalPrice * item.quantity)}
                        </span>
                      )}
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(order.totals.subtotal)}</span>
        </div>
        {order.totals.discount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount{order.appliedCouponCode ? ` (${order.appliedCouponCode})` : ""}</span>
            <span>-{formatPrice(order.totals.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span>{order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.totals.total)}</span>
        </div>
      </div>
    </div>
  )
}
