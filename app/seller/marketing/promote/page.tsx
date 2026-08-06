"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Package, Zap } from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { getProductsBySeller } from "@/services/product.service"
import { getCoverImageUrl } from "@/lib/product-images"
import { ProductImage } from "@/components/product-image"
import { formatPrice } from "@/lib/products"
import { createAdOrder, verifyAdPayment } from "@/lib/seller-ads-client"
import { loadRazorpayCheckoutScript } from "@/lib/razorpay-checkout-script"
import { AD_DURATION_OPTIONS, AD_POSITIONS, AD_POSITION_LABELS, type AdDurationDays, type AdPosition } from "@/types/sponsored-ad"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"

export default function PromoteProductPage() {
  const gate = useSellerGate()
  const sellerUid = gate.state === "approved" ? gate.uid : null
  const router = useRouter()

  const [products, setProducts] = useState<Product[] | null>(null)
  const [productId, setProductId] = useState<string>("")
  const [duration, setDuration] = useState<AdDurationDays>(7)
  const [position, setPosition] = useState<AdPosition>("after-trending")
  const [pricing, setPricing] = useState<Record<string, number> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!sellerUid) return
    getProductsBySeller(sellerUid).then((all) => setProducts(all.filter((p) => p.status === "approved")))
  }, [sellerUid])

  useEffect(() => {
    fetch("/api/ads/pricing")
      .then((r) => r.json())
      .then((data) => setPricing(data.feeByDurationDays))
      .catch(() => setPricing(null))
  }, [])

  const selectedProduct = products?.find((p) => p.id === productId)
  const fee = pricing?.[String(duration)] ?? null

  async function handlePromote() {
    if (!productId) {
      setError("Choose a product to promote.")
      return
    }
    setError("")
    setSubmitting(true)

    const created = await createAdOrder({ productId, durationDays: duration, position })
    if (!created.ok) {
      setSubmitting(false)
      setError(created.error)
      return
    }

    try {
      await loadRazorpayCheckoutScript()
    } catch {
      setSubmitting(false)
      setError("Couldn't load the payment gateway. Please try again.")
      return
    }

    const RazorpayCheckout = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
    const rzp = new RazorpayCheckout({
      key: created.keyId,
      amount: created.amount,
      currency: created.currency,
      order_id: created.razorpayOrderId,
      name: "IXOFLORA",
      description: `Sponsored Ad — ${duration} day${duration > 1 ? "s" : ""}`,
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const result = await verifyAdPayment({ adId: created.adId, ...response })
        setSubmitting(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success("Payment received! Your promotion is awaiting admin approval.")
        router.push("/seller/marketing")
      },
      modal: {
        ondismiss: () => setSubmitting(false),
      },
    })
    rzp.open()
  }

  if (gate.state !== "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8F2] px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Seller Access Required</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in as an approved seller to promote products.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F8F2] px-3 py-4 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/seller/marketing" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black">
          <ArrowLeft className="size-4" />
          Back to Marketing
        </Link>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-green-700" />
            <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Promote a Product</h1>
          </div>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Your product gets featured in a real homepage slot for the duration you choose.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-900">1. Choose a Product</p>
            {products === null && <p className="text-sm text-gray-500">Loading your products...</p>}
            {products && products.length === 0 && (
              <p className="text-sm text-gray-500">You don&apos;t have any approved products to promote yet.</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products?.map((p) => {
                const cover = getCoverImageUrl(p.images)
                const active = productId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProductId(p.id)}
                    className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition ${
                      active ? "border-green-600 ring-2 ring-green-100" : "border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <div className="relative aspect-square bg-white">
                      {cover ? (
                        <ProductImage src={cover} alt={p.name} className="absolute inset-0" padding="sm" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="size-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-2 p-2 text-xs font-medium text-gray-900">{p.name}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-900">2. Choose a Duration</p>
            <div className="flex flex-wrap gap-2">
              {AD_DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                    duration === d ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-700 hover:border-green-300"
                  }`}
                >
                  {d} Day{d > 1 ? "s" : ""}
                  {pricing && <span className="ml-1.5 font-normal text-gray-500">{formatPrice(pricing[String(d)] ?? 0)}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-900">3. Preferred Placement</p>
            <div className="flex flex-col gap-2">
              {AD_POSITIONS.map((pos) => (
                <label
                  key={pos}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm transition ${
                    position === pos ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-300"
                  }`}
                >
                  <input type="radio" checked={position === pos} onChange={() => setPosition(pos)} />
                  {AD_POSITION_LABELS[pos]}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400">The admin may adjust your placement after review.</p>
          </div>

          {selectedProduct && fee !== null && (
            <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-900">
              Promoting <strong>{selectedProduct.name}</strong> for {duration} day{duration > 1 ? "s" : ""} costs{" "}
              <strong>{formatPrice(fee)}</strong>.
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <Button className="mt-6 h-10 w-full" onClick={handlePromote} disabled={submitting || !productId}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : `Pay ${fee !== null ? formatPrice(fee) : ""} & Submit for Approval`}
          </Button>
        </div>
      </div>
    </div>
  )
}
