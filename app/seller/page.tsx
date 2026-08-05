"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Package, ShoppingBag, Clock, Wallet as WalletIcon } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getProductsBySeller } from "@/services/product.service"
import { getOrdersBySeller } from "@/services/order.service"
import { fetchMyWallet } from "@/lib/seller-wallet-client"
import { formatPrice } from "@/lib/products"
import { StatCard } from "@/components/seller/stat-card"

const PENDING_STATUSES = new Set(["Pending", "Accepted", "Ready To Pack", "Packed", "Pickup Requested", "Picked Up", "In Transit", "Out For Delivery"])

/** The seller's landing page — a real overview built from the same data
 * every other seller page already fetches (product count, order counts,
 * wallet balance), not a placeholder. Quick links go straight to the
 * section that has the detail. */
export default function SellerDashboardPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [productCount, setProductCount] = useState<number | null>(null)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!sellerUid) return
    getProductsBySeller(sellerUid).then((products) => setProductCount(products.length))
    getOrdersBySeller(sellerUid).then((orders) => {
      const mine = orders
        .map((o) => o.sellerOrders.find((so) => so.sellerId === sellerUid))
        .filter((so): so is NonNullable<typeof so> => so !== undefined)
      setOrderCount(mine.length)
      setPendingCount(mine.filter((so) => PENDING_STATUSES.has(so.status)).length)
    })
    fetchMyWallet().then((result) => {
      if (result.ok) setWalletBalance(result.wallet.balance)
    })
  }, [sellerUid])

  if (gate.state === "loading") {
    return <div className="py-16 text-center text-sm text-[#444444]">Loading...</div>
  }
  if (gate.state !== "approved") {
    return <div className="py-16 text-center text-sm text-[#444444]">You need an approved seller account to view this page.</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-black">Dashboard</h1>
      <p className="mt-1 text-sm text-[#444444]">A quick look at your store.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Package} label="Products" value={productCount ?? "—"} />
        <StatCard icon={ShoppingBag} label="Total Orders" value={orderCount ?? "—"} />
        <StatCard icon={Clock} label="Pending Orders" value={pendingCount ?? "—"} />
        <StatCard icon={WalletIcon} label="Wallet Balance" value={walletBalance === null ? "—" : formatPrice(walletBalance)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/seller/orders" className="rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-green-600">
          <p className="font-bold text-black">Orders</p>
          <p className="mt-1 text-sm text-[#444444]">Fulfil orders and manage your wallet.</p>
        </Link>
        <Link href="/seller/products" className="rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-green-600">
          <p className="font-bold text-black">Products</p>
          <p className="mt-1 text-sm text-[#444444]">Add, edit, and manage your listings.</p>
        </Link>
        <Link href="/seller/shipping" className="rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-green-600">
          <p className="font-bold text-black">Shipping</p>
          <p className="mt-1 text-sm text-[#444444]">Track every in-flight shipment.</p>
        </Link>
      </div>
    </div>
  )
}
