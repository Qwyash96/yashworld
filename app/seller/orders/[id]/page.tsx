"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  Package,
  Truck,
  FileText,
  FileDown,
  QrCode,
  Barcode as BarcodeIcon,
  CheckCircle2,
  RefreshCw,
  StickyNote,
  AlertTriangle,
  Download,
  Printer,
  type LucideIcon,
} from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { updateSellerOrderStatus, syncSellerOrderTracking, updateSellerOrderNote } from "@/services/order.service"
import { fetchMySellerOrder } from "@/lib/seller-orders-client"
import { getSellerProfile } from "@/services/seller.service"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { OrderTrackingTimeline } from "@/components/orders/order-tracking-timeline"
import { ProductImage } from "@/components/product-image"
import { isCancellable, isReturnable } from "@/types/order-lifecycle"
import { formatPrice } from "@/lib/products"
import { getDeliveryEstimate } from "@/lib/delivery-estimate"
import { orderDisplayId } from "@/lib/order-display"
import { buildOrderDocumentContext } from "@/lib/documents/order-document-context"
import type { SellerFacingOrder } from "@/lib/seller-order-redaction"
import type { SellerOrder } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const gate = useSellerGate()
  const { getProductById } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [order, setOrder] = useState<SellerFacingOrder | null | undefined>(undefined)
  const [shopName, setShopName] = useState("")
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [previewImage, setPreviewImage] = useState<{ title: string; dataUrl: string; filename: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  function refresh() {
    fetchMySellerOrder(params.id).then(setOrder)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  useEffect(() => {
    if (!sellerUid) return
    getSellerProfile(sellerUid).then((profile) => setShopName(profile?.shopName ?? ""))
  }, [sellerUid])

  const mine = useMemo(() => order?.sellerOrders.find((so) => so.sellerId === sellerUid), [order, sellerUid])

  useEffect(() => {
    setNoteDraft(mine?.note ?? "")
  }, [mine?.note])

  const documentContext = useMemo(() => {
    if (!order || !mine) return null
    const productNames = new Map(mine.items.map((i) => [i.productId, getProductById(i.productId)?.name ?? i.productId]))
    return buildOrderDocumentContext(order, mine, shopName, productNames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, mine, shopName])

  if (gate.state === "loading" || order === undefined) {
    return <div className="mx-auto max-w-6xl px-3 py-10 sm:px-6 sm:py-16">Loading...</div>
  }
  if (gate.state !== "approved") {
    return (
      <div className="mx-auto max-w-6xl px-3 py-10 sm:px-6 sm:py-16">
        <p>You need an approved seller account to view this page.</p>
      </div>
    )
  }
  if (order === null || !mine) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-10 sm:px-6 sm:py-16 text-center">
        <p className="text-black">Order not found.</p>
        <Link href="/seller/orders" className="mt-4 inline-block text-green-700 hover:underline">
          Back to Orders
        </Link>
      </div>
    )
  }

  async function runTransition(update: Parameters<typeof updateSellerOrderStatus>[2]) {
    setBusy(true)
    try {
      await updateSellerOrderStatus(order!.id, sellerUid!, update)
      toast.success("Order updated.")
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order.")
    } finally {
      setBusy(false)
    }
  }

  // Accept is the seller's only fulfilment action. It both moves the order
  // to "Accepted" and (server-side, awaited) attempts real shipment
  // creation with whichever provider is connected — see
  // app/api/seller/orders/[id]/status. Reported here from the actual
  // returned result rather than assumed, since the shipment attempt can
  // fail independently of the Accept itself.
  async function handleAccept() {
    setBusy(true)
    try {
      const result = await updateSellerOrderStatus(order!.id, sellerUid!, { status: "Accepted" })
      if (result.shipment?.ok) {
        toast.success(`Order accepted — shipment created with ${result.shipment.courierPartner}.`)
      } else if (result.shipment && !result.shipment.ok) {
        toast.error(`Order accepted, but shipping setup failed: ${result.shipment.error}`)
      } else {
        toast.success("Order accepted.")
      }
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept order.")
    } finally {
      setBusy(false)
    }
  }

  /** Retries shipment creation after a previous attempt left a real
   * shippingSetupError — re-posts "Accepted" while already "Accepted",
   * which the server treats as a retry rather than an illegal transition. */
  async function handleRetryShipment() {
    setBusy(true)
    try {
      const result = await updateSellerOrderStatus(order!.id, sellerUid!, { status: "Accepted" })
      if (result.shipment?.ok) {
        toast.success(`Shipment created with ${result.shipment.courierPartner}.`)
      } else if (result.shipment && !result.shipment.ok) {
        toast.error(`Shipping setup failed again: ${result.shipment.error}`)
      }
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry shipping setup.")
    } finally {
      setBusy(false)
    }
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("A reason is required to reject an order.")
      return
    }
    runTransition({ status: "Cancelled", reason: rejectReason.trim() }).then(() => {
      setRejectOpen(false)
      setRejectReason("")
    })
  }

  function handleCancel() {
    const reason = window.prompt("Reason for cancellation?")
    if (!reason?.trim()) return
    runTransition({ status: "Cancelled", reason: reason.trim() })
  }

  function handleReturn() {
    const reason = window.prompt("Reason for return? (optional)") ?? undefined
    runTransition({ status: "Returned", ...(reason?.trim() ? { reason: reason.trim() } : {}) })
  }

  async function handleSyncTracking() {
    setSyncing(true)
    try {
      const result = await syncSellerOrderTracking(order!.id)
      const courierLabel = mine?.courierPartner ?? "courier"
      toast.success(result.changed ? `Updated to "${result.status}" (${courierLabel}: ${result.rawStatus}).` : `No change (${courierLabel}: ${result.rawStatus}).`)
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync tracking.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveNote() {
    setSavingNote(true)
    try {
      await updateSellerOrderNote(order!.id, noteDraft)
      toast.success("Note saved.")
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note.")
    } finally {
      setSavingNote(false)
    }
  }

  // jsPDF/jsbarcode/qrcode are only ever needed once a seller actually
  // clicks one of these — dynamically imported here instead of statically
  // at the top of the file so every seller viewing an order doesn't pay
  // for all three libraries in this page's initial JS bundle.
  async function handleGenerateInvoice() {
    if (!documentContext) return
    const { generateInvoicePdf } = await import("@/lib/documents/invoice")
    generateInvoicePdf(documentContext)
  }

  async function handleGeneratePackingSlip() {
    if (!documentContext) return
    const { generatePackingSlipPdf } = await import("@/lib/documents/packing-slip")
    generatePackingSlipPdf(documentContext)
  }

  async function handleGenerateShippingLabel() {
    if (!documentContext) return
    const { generateShippingLabelPdf } = await import("@/lib/documents/shipping-label")
    generateShippingLabelPdf(documentContext)
  }

  async function handleGenerateQr() {
    const { generateOrderQrCodeDataUrl } = await import("@/lib/documents/qr-code")
    const dataUrl = await generateOrderQrCodeDataUrl(order!.id)
    setPreviewImage({ title: "Order QR Code", dataUrl, filename: `order-qr-${order!.id.slice(0, 8)}.png` })
  }

  async function handleGenerateBarcode() {
    const { generateBarcodeDataUrl } = await import("@/lib/documents/barcode")
    const dataUrl = generateBarcodeDataUrl(mine!.trackingNumber ?? order!.id)
    setPreviewImage({ title: "Order Barcode", dataUrl, filename: `order-barcode-${order!.id.slice(0, 8)}.png` })
  }

  const status = mine.status
  const isTerminal = status === "Cancelled" || status === "Returned"

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <Link href="/seller/orders" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Orders
      </Link>

      {/* Order Header */}
      <section className="mt-3 rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-black sm:text-xl">Order #{orderDisplayId(order)}</h1>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#444444] sm:grid-cols-4">
              <span>Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span>{getDeliveryEstimate(order.shippingMethod)}</span>
              <span>Payment: {order.paymentStatus}</span>
              <span>{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</span>
            </div>
          </div>
          <OrderStatusBadge status={status} />
        </div>

        {(isReturnable(status) || (isCancellable(status) && status !== "Pending")) && (
          <div className="-mx-3 mt-4 flex flex-nowrap gap-2 overflow-x-auto border-t border-border px-3 pt-3 sm:mx-0 sm:flex-wrap sm:px-0">
            {isReturnable(status) && (
              <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={handleReturn} disabled={busy}>
                Mark Returned
              </Button>
            )}
            {isCancellable(status) && status !== "Pending" && (
              <Button size="sm" variant="outline" className="h-9 shrink-0 text-red-600" onClick={handleCancel} disabled={busy}>
                Cancel Order
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
        {/* MAIN column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Product Information */}
          <Card title="Product Information" icon={Package}>
            <div className="flex flex-col divide-y divide-border">
              {mine.items.map((item) => {
                const product = getProductById(item.productId)
                const hasDiscount = item.originalPrice !== undefined && item.originalPrice > item.price
                return (
                  <div key={item.productId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage src={product?.image} alt={product?.name ?? item.productId} className="absolute inset-0" padding="sm" sizes="96px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black">{product?.name ?? item.productId}</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#444444] sm:grid-cols-3">
                        <span>SKU: {item.productId.slice(0, 10)}</span>
                        <span>Category: {product?.category ?? "—"}</span>
                        <span>Variant: {product ? `${product.colors[0]} / ${product.sizes[0]}` : "—"}</span>
                        <span>Qty: {item.quantity}</span>
                        <span>
                          Price: {formatPrice(item.price)}
                          {hasDiscount && <span className="ml-1 line-through text-[#888888]">{formatPrice(item.originalPrice!)}</span>}
                        </span>
                        {hasDiscount && (
                          <span>Discount: {formatPrice((item.originalPrice! - item.price) * item.quantity)}</span>
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 font-semibold text-black">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <Row label="Seller Earnings" value={formatPrice(mine.payoutAmount)} />
              <Row label="Platform Commission" value={formatPrice(mine.commissionAmount)} />
              <Row label="GST" value="Included in price" />
              <Row label="Delivery Charges" value={formatPrice(order.totals.shipping)} />
              <Row label="Net Payout" value={formatPrice(mine.payoutAmount)} bold />
            </div>
          </Card>

          {/* Tracking Timeline */}
          <Card title="Tracking Timeline">
            <OrderTrackingTimeline status={status} timeline={mine.timeline} createdAt={order.createdAt} />
          </Card>

          {/* Action Panel — the seller's only fulfilment action is Accept
              (or Reject) a Pending order. Every stage after that —
              shipment creation, pickup, in-transit, delivered — is driven
              automatically by whichever shipping provider is connected
              (see app/api/seller/orders/[id]/status and
              lib/order-auto-fulfillment.ts); "Sync Now" pulls the real
              current status from the provider rather than letting the
              seller set it manually. */}
          <Card title="Action Panel">
            {status !== "Pending" && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Button size="sm" variant="outline" className="h-9" onClick={handleGenerateInvoice}>
                  <FileText className="size-3.5" />
                  Print Invoice
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleGeneratePackingSlip}>
                  <Package className="size-3.5" />
                  Packing Slip
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleGenerateShippingLabel}>
                  <FileDown className="size-3.5" />
                  Generate Label
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleGenerateQr}>
                  <QrCode className="size-3.5" />
                  QR
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleGenerateBarcode}>
                  <BarcodeIcon className="size-3.5" />
                  Barcode
                </Button>
              </div>
            )}

            <div className={status !== "Pending" ? "mt-3 border-t border-border pt-3" : ""}>
              {status === "Pending" && (
                <div className="flex gap-2">
                  <Button className="h-10 flex-1" onClick={handleAccept} disabled={busy}>
                    Accept Order
                  </Button>
                  <Button variant="destructive" className="h-10 flex-1" onClick={() => setRejectOpen(true)} disabled={busy}>
                    Reject Order
                  </Button>
                </div>
              )}
              {status === "Accepted" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">Shipping setup pending</p>
                      <p className="mt-0.5 text-xs text-amber-800">
                        {mine.shippingSetupError ?? "The shipping provider hasn't confirmed this shipment yet."}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-9 w-fit" onClick={handleRetryShipment} disabled={busy}>
                    <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
                    Retry Shipping Setup
                  </Button>
                </div>
              )}
              {(status === "Pickup Requested" || status === "Picked Up" || status === "In Transit" || status === "Out For Delivery") && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-[#444444]">Status updates automatically from the shipping provider.</p>
                  <Button size="sm" variant="outline" className="h-9" onClick={handleSyncTracking} disabled={syncing}>
                    <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
                    Sync Now
                  </Button>
                </div>
              )}
              {status === "Delivered" && (
                <p className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle2 className="size-4" />
                  Delivered
                </p>
              )}
              {isTerminal && (
                <p className="text-sm text-[#444444]">
                  {status === "Cancelled" ? "This order was cancelled." : "This order was returned."}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* SIDEBAR column */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Customer Information — buyer phone/email are deliberately never
              fetched for a seller (redacted server-side, see
              lib/seller-order-redaction.ts) and must never be added back
              here. The courier still gets them automatically, straight from
              the backend, during AWB generation (lib/order-status-transition's
              caller in app/api/seller/orders/[id]/status/route.ts). */}
          <Card title="Customer Information">
            <p className="font-semibold text-black">{order.shippingAddress.fullName}</p>
            <p className="mt-1.5 text-sm text-[#444444]">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              {order.shippingAddress.landmark && (
                <>
                  <br />
                  Landmark: {order.shippingAddress.landmark}
                </>
              )}
            </p>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <Row label="City" value={order.shippingAddress.city} />
              <Row label="State" value={order.shippingAddress.state} />
              <Row label="PIN Code" value={order.shippingAddress.postalCode} />
            </div>
          </Card>

          {/* Courier Section — every value here is exactly what the shipping
              provider returned (see lib/order-status-transition.ts's
              buildAutoShippedSellerOrder and lib/order-tracking-sync.ts);
              nothing is invented while the provider hasn't confirmed it. */}
          <Card title="Courier Section" icon={Truck}>
            {!mine.courierPartner ? (
              <p className="text-sm text-[#444444]">No courier assigned yet.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5 text-sm">
                  <Row label="Courier Partner" value={mine.courierPartner} />
                  <Row label="Tracking / AWB Number" value={mine.trackingNumber ?? "—"} />
                  <Row label="Pickup" value={pickupDisplay(mine)} />
                  <Row label="Shipping Status" value={status} />
                </div>

                {pickupDisplay(mine) !== "Awaiting courier confirmation" && (
                  <p className="mt-2.5 text-xs text-[#666666]">Please keep the parcel packed and ready before the scheduled pickup time.</p>
                )}

                <div className="mt-3 border-t border-border pt-3">
                  {mine.labelUrl ? (
                    <div className="flex flex-wrap gap-2">
                      <a href={mine.labelUrl} download target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-9">
                          <Download className="size-3.5" />
                          Download Label
                        </Button>
                      </a>
                      <a href={mine.labelUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-9">
                          <Printer className="size-3.5" />
                          Print Label
                        </Button>
                      </a>
                    </div>
                  ) : (
                    mine.labelStatus === "pending" && <p className="text-sm text-[#444444]">Shipping label is being generated.</p>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Notes */}
          <Card title="Notes">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seller-note" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#666666]">
                <StickyNote className="size-3.5" />
                Seller Notes
              </Label>
              <textarea
                id="seller-note"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Private note — packing reminders, etc. Never shown to the buyer."
                className="min-h-16 w-full rounded-lg border border-border p-2.5 text-sm outline-none focus:border-primary"
              />
              <Button size="sm" className="h-9 w-fit" onClick={handleSaveNote} disabled={savingNote || noteDraft === (mine.note ?? "")}>
                {savingNote ? "Saving..." : "Save Note"}
              </Button>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#666666]">Admin Notes</p>
              <p className="mt-1 text-sm text-[#444444]">{order.adminNote || "No notes from admin yet."}</p>
            </div>
          </Card>

          {/* Order Summary */}
          <Card title="Order Summary">
            <div className="flex flex-col gap-1.5 text-sm">
              <Row label="Subtotal" value={formatPrice(order.totals.subtotal)} />
              <Row label="Discount" value={`-${formatPrice(order.totals.discount)}`} />
              <Row label="Delivery Charge" value={formatPrice(order.totals.shipping)} />
              <Row label="Platform Commission" value={formatPrice(mine.commissionAmount)} />
              <Row label="GST" value="Included in price" />
              <div className="mt-1 border-t border-border pt-1.5">
                <Row label="Net Seller Amount" value={formatPrice(mine.payoutAmount)} bold />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogTitle>Reject Order</DialogTitle>
          <div className="mt-4 flex flex-col gap-3">
            <Label htmlFor="reject-reason">Reason</Label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="h-24 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primary"
              placeholder="Out of stock, unable to fulfill, ..."
            />
            <Button className="h-10" onClick={handleReject} disabled={busy}>
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR / Barcode preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent>
          {previewImage && (
            <>
              <DialogTitle>{previewImage.title}</DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage.dataUrl} alt={previewImage.title} className="mx-auto mt-4 max-w-full" />
              <a
                href={previewImage.dataUrl}
                download={previewImage.filename}
                className="mt-4 block rounded-xl bg-green-600 px-4 py-2.5 text-center font-semibold text-white hover:bg-green-700"
              >
                Download
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Shows exactly what the shipping provider returned — an exact
 * date+time, a window, or, absent either, an honest "awaiting
 * confirmation" rather than a fabricated pickup time. */
function pickupDisplay(mine: SellerOrder): string {
  if (mine.pickupWindow) return mine.pickupWindow
  if (mine.pickupDate && mine.pickupTime) return `${mine.pickupDate} ${mine.pickupTime}`
  if (mine.pickupDate) return mine.pickupDate
  return "Awaiting courier confirmation"
}

function Card({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#666666]">
        {Icon && <Icon className="size-3.5 text-green-700" />}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#444444]">{label}</span>
      <span className={bold ? "font-semibold text-black" : "text-black"}>{value}</span>
    </div>
  )
}
