"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, FileText, Receipt, Download } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { getOrderById } from "@/services/order.service"
import { getReview } from "@/services/review.service"
import { getSellerProfile } from "@/services/seller.service"
import { formatPrice } from "@/lib/products"
import type { Order } from "@/types/order"
import type { Review } from "@/types/review"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { OrderTrackingTimeline } from "@/components/orders/order-tracking-timeline"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ReviewStars } from "@/components/reviews/review-stars"
import { WriteReviewDialog } from "@/components/reviews/write-review-dialog"
import { isCancellable } from "@/types/order-lifecycle"
import { getDeliveryEstimate } from "@/lib/delivery-estimate"
import { getPublicTrackingUrl } from "@/lib/public-tracking-url"
import { orderDisplayId } from "@/lib/order-display"
import { fetchFinanceDocuments, fetchFinanceDocumentDetail, generateFinanceDocument } from "@/lib/admin-finance-client"
import { fetchBusinessInfo, type RefundDocumentContext } from "@/lib/documents/finance-document-context"
import { buildPaymentReceiptPdf } from "@/lib/documents/payment-receipt"
import { buildRefundReceiptPdf } from "@/lib/documents/refund-receipt"
import { downloadPdf } from "@/lib/documents/pdf-actions"
import { buildOrderDocumentContext } from "@/lib/documents/order-document-context"
import { FINANCE_DOCUMENT_LABELS, type FinanceDocument } from "@/types/finance-document"
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
  const [reviewsByProduct, setReviewsByProduct] = useState<Record<string, Review | null>>({})
  const [reviewDialogProductId, setReviewDialogProductId] = useState<string | null>(null)
  const [cancelDialogSellerId, setCancelDialogSellerId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<FinanceDocument[]>([])
  const [docBusy, setDocBusy] = useState<string | null>(null)
  const [sellerShopNames, setSellerShopNames] = useState<Record<string, string>>({})

  useEffect(() => {
    getOrderById(params.id).then(setOrder)
  }, [params.id])

  // Marketplace-style "Sold by: [Seller Business Name]" — resolved here,
  // once the order loads, straight from sellers/{uid}.shopName (public-read,
  // see services/seller.service.ts) rather than ever showing the raw
  // sellerId. "yashworld" is the platform's own first-party fulfilment,
  // not a real seller doc, so it's special-cased to "IXOFLORA" below.
  useEffect(() => {
    if (order === "loading" || !order) return
    const sellerIds = Array.from(new Set(order.sellerOrders.map((so) => so.sellerId))).filter((id) => id !== "yashworld")
    sellerIds.forEach((sellerId) => {
      getSellerProfile(sellerId)
        .then((seller) => {
          if (seller) setSellerShopNames((prev) => ({ ...prev, [sellerId]: seller.shopName }))
        })
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order === "loading" ? null : order?.id])

  useEffect(() => {
    fetchFinanceDocuments({ orderId: params.id }).then((result) => {
      if (result.ok) setDocuments(result.documents)
    })
  }, [params.id])

  useEffect(() => {
    if (order === "loading" || !order) return
    const deliveredProductIds = order.sellerOrders
      .filter((so) => so.status === "Delivered")
      .flatMap((so) => so.items.map((item) => item.productId))
    deliveredProductIds.forEach((productId) => {
      getReview(order.id, productId).then((review) =>
        setReviewsByProduct((prev) => ({ ...prev, [productId]: review })),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order === "loading" ? null : order?.id])

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

  // TS can't carry the narrowing from the guard above into the nested
  // function declarations below (their closure re-widens `order` back to
  // its full `Order | null | "loading"` declared type) — this local const
  // is a real `Order` for the rest of this render, used by those handlers.
  const currentOrder: Order = order

  // Marketplace-style seller display name — NEVER the raw sellerId. Falls
  // back to "Seller" only for the brief moment before getSellerProfile
  // resolves (or if it's genuinely unavailable), matching the "never show
  // an internal identifier" requirement even in that edge case.
  function sellerDisplayName(sellerId: string): string {
    if (sellerId === "yashworld") return "IXOFLORA"
    return sellerShopNames[sellerId] ?? "Seller"
  }

  async function handleGenerateInvoice(sellerOrder: Order["sellerOrders"][number]) {
    setDocBusy(`invoice-${sellerOrder.sellerId}`)
    try {
      const result = await generateFinanceDocument("invoice", currentOrder.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const productNames = new Map(sellerOrder.items.map((i) => [i.productId, getProductById(i.productId)?.name ?? i.productId]))
      const ctx = buildOrderDocumentContext(
        currentOrder,
        sellerOrder,
        sellerDisplayName(sellerOrder.sellerId),
        productNames,
      )
      const { generateInvoicePdf } = await import("@/lib/documents/invoice")
      generateInvoicePdf(ctx)
      setDocuments((prev) => [...prev, result.document])
    } finally {
      setDocBusy(null)
    }
  }

  async function handleGeneratePaymentReceipt() {
    setDocBusy("payment-receipt")
    try {
      const result = await generateFinanceDocument("payment_receipt", currentOrder.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const business = await fetchBusinessInfo()
      const doc = buildPaymentReceiptPdf({
        business,
        documentNumber: result.document.documentNumber,
        orderId: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        createdAt: result.document.createdAt,
        customerName: currentOrder.shippingAddress.fullName,
        amount: currentOrder.totals.total,
        paymentMethod: currentOrder.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
        paymentStatus: currentOrder.paymentStatus,
      })
      downloadPdf(doc, `${result.document.documentNumber}.pdf`)
      setDocuments((prev) => [...prev, result.document])
    } finally {
      setDocBusy(null)
    }
  }

  async function handleDownloadRefundReceipt(document: FinanceDocument) {
    setDocBusy(document.id)
    try {
      const result = await fetchFinanceDocumentDetail<RefundDocumentContext>(document.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const doc = buildRefundReceiptPdf(result.context)
      downloadPdf(doc, `${result.context.documentNumber}.pdf`)
    } finally {
      setDocBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {confirmed && (
        <div className="mb-8 flex items-center gap-3 rounded-md border border-green-600/30 bg-green-50 p-4 text-green-800">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-sm font-medium">Order confirmed — thank you for shopping with IXOFLORA!</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Order #{orderDisplayId(order)}
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
            {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"} ·{" "}
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
                Sold by: {sellerDisplayName(sellerOrder.sellerId)}
              </p>
              <OrderStatusBadge status={sellerOrder.status} />
            </div>
            {isCancellable(sellerOrder.status) && (
              <Button
                type="button"
                variant="destructive"
                className="mt-3 h-9 w-full sm:w-auto"
                onClick={() => setCancelDialogSellerId(sellerOrder.sellerId)}
              >
                Cancel Order
              </Button>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {sellerOrder.items.map((item) => {
                const product = getProductById(item.productId)
                const sourceLabel = item.discountSource ? DISCOUNT_SOURCE_LABELS[item.discountSource] : undefined
                const existingReview = reviewsByProduct[item.productId]
                return (
                  <li key={item.productId}>
                    <div className="flex justify-between">
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
                    </div>
                    {sellerOrder.status === "Delivered" && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {existingReview && <ReviewStars rating={existingReview.rating} size="sm" />}
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setReviewDialogProductId(item.productId)}
                        >
                          {existingReview ? "Edit Review" : "Write a Review"}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {(sellerOrder.courierPartner || sellerOrder.trackingNumber) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {sellerOrder.courierPartner && <span>Courier: {sellerOrder.courierPartner}</span>}
                {sellerOrder.trackingNumber && <span>AWB: {sellerOrder.trackingNumber}</span>}
                {sellerOrder.status !== "Delivered" && sellerOrder.status !== "Cancelled" && sellerOrder.status !== "Returned" && (
                  <span>Estimated Delivery: {getDeliveryEstimate(order.shippingMethod)}</span>
                )}
                {getPublicTrackingUrl(sellerOrder.shippingProvider, sellerOrder.trackingNumber) && (
                  <a
                    href={getPublicTrackingUrl(sellerOrder.shippingProvider, sellerOrder.trackingNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
                  >
                    Track Shipment
                  </a>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <OrderTrackingTimeline status={sellerOrder.status} timeline={sellerOrder.timeline} createdAt={order.createdAt} />
            </div>
          </div>
        ))}
      </div>

      {cancelDialogSellerId && (
        <CancelOrderDialog
          open={!!cancelDialogSellerId}
          onOpenChange={(open) => !open && setCancelDialogSellerId(null)}
          orderId={order.id}
          sellerId={cancelDialogSellerId}
          onCancelled={() => getOrderById(order.id).then(setOrder)}
        />
      )}

      {reviewDialogProductId && (
        <WriteReviewDialog
          open={!!reviewDialogProductId}
          onOpenChange={(open) => !open && setReviewDialogProductId(null)}
          orderId={order.id}
          productId={reviewDialogProductId}
          productName={getProductById(reviewDialogProductId)?.name ?? reviewDialogProductId}
          buyerName={user.name}
          buyerUid={user.uid}
          existingReview={reviewsByProduct[reviewDialogProductId] ?? null}
          onSaved={(review) => setReviewsByProduct((prev) => ({ ...prev, [reviewDialogProductId]: review }))}
        />
      )}

      <Separator className="my-6" />

      <h2 className="font-medium">Documents</h2>
      <div className="mt-4 space-y-2">
        {order.sellerOrders.map((so) => (
          <Button
            key={so.sellerId}
            type="button"
            variant="outline"
            className="h-9 w-full justify-start sm:w-auto"
            disabled={docBusy === `invoice-${so.sellerId}`}
            onClick={() => handleGenerateInvoice(so)}
          >
            <FileText className="size-4" />
            Invoice {order.sellerOrders.length > 1 ? `— ${sellerDisplayName(so.sellerId)}` : ""}
          </Button>
        ))}
        {(order.paymentStatus === "Paid" || order.paymentStatus === "Refunded") && (
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-start sm:w-auto"
            disabled={docBusy === "payment-receipt"}
            onClick={handleGeneratePaymentReceipt}
          >
            <Receipt className="size-4" />
            Payment Receipt
          </Button>
        )}
        {documents
          .filter((d) => d.type === "refund_receipt" || d.type === "credit_note")
          .map((d) => (
            <Button
              key={d.id}
              type="button"
              variant="outline"
              className="h-9 w-full justify-start sm:w-auto"
              disabled={docBusy === d.id}
              onClick={() => handleDownloadRefundReceipt(d)}
            >
              <Download className="size-4" />
              {FINANCE_DOCUMENT_LABELS[d.type]} — {d.documentNumber}
            </Button>
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
