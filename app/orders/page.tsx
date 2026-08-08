"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useStore } from "@/components/store-provider"
import { getOrdersByBuyer } from "@/services/order.service"
import { formatPrice } from "@/lib/products"
import { orderDisplayId } from "@/lib/order-display"
import type { Order } from "@/types/order"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"

export default function OrdersPage() {
  const { user } = useStore()
  const [orders, setOrders] = useState<Order[] | null>(null)

  useEffect(() => {
    if (!user) return
    getOrdersByBuyer(user.uid).then(setOrders)
  }, [user])

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-4">Sign in to see your orders.</p>
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">My Orders</h1>

      {orders === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You haven&apos;t placed any orders yet.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                  Order #{orderDisplayId(order)}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                  {formatPrice(order.totals.total)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
