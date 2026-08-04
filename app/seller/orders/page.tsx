"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { getOrdersBySeller, updateSellerOrderStatus } from "@/services/order.service"
import { fetchMyWallet, requestWithdrawal } from "@/lib/seller-wallet-client"
import { formatPrice } from "@/lib/products"
import type { Order, OrderStatus } from "@/types/order"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DiscountSource } from "@/types/order"

const DISCOUNT_SOURCE_LABELS: Partial<Record<DiscountSource, string>> = {
  scheduled_offer: "Scheduled Offer",
  campaign: "Campaign",
  seller_coupon: "Coupon",
}

const STATUS_OPTIONS: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Packing",
  "Ready To Ship",
  "Shipped",
  "Out For Delivery",
  "Delivered",
  "Cancelled",
]

export default function SellerOrdersPage() {
  const gate = useSellerGate()
  const { getProductById } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [wallet, setWallet] = useState<SellerWallet | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [requesting, setRequesting] = useState(false)

  function refreshWallet() {
    fetchMyWallet().then((result) => {
      if (result.ok) {
        setWallet(result.wallet)
        setWithdrawals(result.withdrawals)
      }
    })
  }

  useEffect(() => {
    if (!sellerUid) return
    getOrdersBySeller(sellerUid).then(setOrders)
    refreshWallet()
  }, [sellerUid])

  async function handleRequestWithdrawal() {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    setRequesting(true)
    const result = await requestWithdrawal(amount)
    setRequesting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Withdrawal requested.")
    setWithdrawAmount("")
    refreshWallet()
  }

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    if (!sellerUid) return
    await updateSellerOrderStatus(orderId, sellerUid, status)
    setOrders((prev) =>
      prev
        ? prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  sellerOrders: o.sellerOrders.map((so) =>
                    so.sellerId === sellerUid ? { ...so, status } : so,
                  ),
                }
              : o,
          )
        : prev,
    )
  }

  if (gate.state === "loading") {
    return <div className="mx-auto max-w-5xl px-4 py-16">Loading...</div>
  }
  if (gate.state === "signed-out") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p className="mb-4">Sign in to access the seller dashboard.</p>
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </div>
    )
  }
  if (gate.state !== "approved") {
    if (gate.state === "rejected") {
      return (
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="mb-4">
            {gate.reason || "Your seller application was rejected. Please review and resubmit."}
          </p>
          <Link href="/sell/register" className="underline underline-offset-4">
            Edit &amp; Resubmit
          </Link>
        </div>
      )
    }
    const message =
      gate.state === "not-applied"
        ? "You haven't applied to become a seller yet."
        : "Your seller application is pending admin approval."
    return <div className="mx-auto max-w-5xl px-4 py-16">{message}</div>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">My Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Only your own items within each order are shown here.
      </p>

      {wallet && (
        <div className="mt-6 rounded-md border border-border p-4">
          <h2 className="font-medium">Wallet</h2>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="text-lg font-semibold">{formatPrice(wallet.balance)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">On Hold</p>
              <p className="text-lg font-semibold">{formatPrice(wallet.pendingBalance)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lifetime Withdrawn</p>
              <p className="text-lg font-semibold">{formatPrice(wallet.lifetimeWithdrawn)}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Amount to withdraw"
              className="h-9 w-48"
            />
            <Button size="sm" className="h-9" disabled={requesting || wallet.balance <= 0} onClick={handleRequestWithdrawal}>
              {requesting ? "Requesting..." : "Request Withdrawal"}
            </Button>
          </div>
          {withdrawals && withdrawals.length > 0 && (
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex justify-between">
                  <span>{formatPrice(w.amount)} — {new Date(w.requestedAt).toLocaleDateString()}</span>
                  <span className="capitalize">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {orders === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {orders.map((order) => {
            const mine = order.sellerOrders.find((so) => so.sellerId === sellerUid)
            if (!mine) return null
            const total = mine.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
            return (
              <li key={order.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()} · {formatPrice(total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Commission {formatPrice(mine.commissionAmount)} · Payout {formatPrice(mine.payoutAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={mine.status} />
                    <Select
                      value={mine.status}
                      onValueChange={(v) => {
                        if (v) handleStatusChange(order.id, v as OrderStatus)
                      }}
                    >
                      <SelectTrigger className="w-40">
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
                  </div>
                </div>
                <ul className="mt-4 space-y-1 text-sm">
                  {mine.items.map((item) => {
                    const product = getProductById(item.productId)
                    const sourceLabel = item.discountSource ? DISCOUNT_SOURCE_LABELS[item.discountSource] : undefined
                    return (
                      <li
                        key={item.productId}
                        className="flex justify-between text-muted-foreground"
                      >
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
                            <span className="mr-2 text-xs line-through">{formatPrice(item.originalPrice * item.quantity)}</span>
                          )}
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
