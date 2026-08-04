"use client"

import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  MapPin,
  Package,
  Truck,
  FileText,
  FileDown,
  QrCode,
  Barcode as BarcodeIcon,
  CalendarClock,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react"
import { useSellerGate } from "@/hooks/use-seller-status"
import { useStore } from "@/components/store-provider"
import { getOrderById, updateSellerOrderStatus } from "@/services/order.service"
import { getSellerProfile } from "@/services/seller.service"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable, isReturnable } from "@/types/order-lifecycle"
import { formatPrice } from "@/lib/products"
import { buildOrderDocumentContext } from "@/lib/documents/order-document-context"
import { generateInvoicePdf } from "@/lib/documents/invoice"
import { generateShippingLabelPdf } from "@/lib/documents/shipping-label"
import { generatePackingSlipPdf } from "@/lib/documents/packing-slip"
import { generateOrderQrCodeDataUrl } from "@/lib/documents/qr-code"
import { generateBarcodeDataUrl } from "@/lib/documents/barcode"
import type { Order, OrderStatus } from "@/types/order"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const COURIER_OPTIONS = ["Shiprocket", "Delhivery", "Blue Dart", "Xpressbees", "DTDC", "Other"]

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const gate = useSellerGate()
  const { getProductById } = useStore()
  const sellerUid = gate.state === "approved" ? gate.uid : null

  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [shopName, setShopName] = useState("")
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [pickupOpen, setPickupOpen] = useState(false)
  const [courierPartner, setCourierPartner] = useState(COURIER_OPTIONS[0])
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTime, setPickupTime] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [previewImage, setPreviewImage] = useState<{ title: string; dataUrl: string; filename: string } | null>(null)

  function refresh() {
    getOrderById(params.id).then(setOrder)
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

  const documentContext = useMemo(() => {
    if (!order || !mine) return null
    const productNames = new Map(mine.items.map((i) => [i.productId, getProductById(i.productId)?.name ?? i.productId]))
    return buildOrderDocumentContext(order, mine, shopName, productNames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, mine, shopName])

  if (gate.state === "loading" || order === undefined) {
    return <div className="mx-auto max-w-5xl px-4 py-16">Loading...</div>
  }
  if (gate.state !== "approved") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p>You need an approved seller account to view this page.</p>
      </div>
    )
  }
  if (order === null || !mine) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
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

  function handleAccept() {
    runTransition({ status: "Accepted" })
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

  function handleAdvance(next: OrderStatus) {
    runTransition({ status: next })
  }

  function handleConfirmPickup() {
    if (!courierPartner) {
      toast.error("Select a courier partner.")
      return
    }
    runTransition({
      status: "Pickup Requested",
      courierPartner,
      ...(pickupDate ? { pickupDate } : {}),
      ...(pickupTime ? { pickupTime } : {}),
      ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
    }).then(() => setPickupOpen(false))
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

  async function handleGenerateQr() {
    const dataUrl = await generateOrderQrCodeDataUrl(order!.id)
    setPreviewImage({ title: "Order QR Code", dataUrl, filename: `order-qr-${order!.id.slice(0, 8)}.png` })
  }

  function handleGenerateBarcode() {
    const dataUrl = generateBarcodeDataUrl(mine!.trackingNumber ?? order!.id)
    setPreviewImage({ title: "Order Barcode", dataUrl, filename: `order-barcode-${order!.id.slice(0, 8)}.png` })
  }

  const status = mine.status

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/seller/orders" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-[#444444]">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <OrderStatusBadge status={status} />
      </div>

      {/* Action Buttons */}
      <section className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm">
        {status === "Pending" && (
          <>
            <Button className="h-10" onClick={handleAccept} disabled={busy}>
              Accept Order
            </Button>
            <Button variant="destructive" className="h-10" onClick={() => setRejectOpen(true)} disabled={busy}>
              Reject Order
            </Button>
          </>
        )}
        {status === "Accepted" && (
          <Button className="h-10" onClick={() => handleAdvance("Ready To Pack")} disabled={busy}>
            Mark Ready to Pack
          </Button>
        )}
        {status === "Ready To Pack" && (
          <Button className="h-10" onClick={() => handleAdvance("Packed")} disabled={busy}>
            Mark Packed
          </Button>
        )}
        {status === "Packed" && (
          <Button className="h-10" onClick={() => setPickupOpen(true)} disabled={busy}>
            Schedule Pickup
          </Button>
        )}
        {status === "Pickup Requested" && (
          <Button className="h-10" onClick={() => handleAdvance("Picked Up")} disabled={busy}>
            Handed To Courier
          </Button>
        )}
        {status === "Picked Up" && (
          <Button className="h-10" onClick={() => handleAdvance("In Transit")} disabled={busy}>
            Mark In Transit
          </Button>
        )}
        {status === "In Transit" && (
          <Button className="h-10" onClick={() => handleAdvance("Out For Delivery")} disabled={busy}>
            Mark Out For Delivery
          </Button>
        )}
        {status === "Out For Delivery" && (
          <Button className="h-10" onClick={() => handleAdvance("Delivered")} disabled={busy}>
            Mark Delivered
          </Button>
        )}
        {isReturnable(status) && (
          <Button variant="outline" className="h-10" onClick={handleReturn} disabled={busy}>
            Mark Returned
          </Button>
        )}
        {isCancellable(status) && status !== "Pending" && (
          <Button variant="outline" className="h-10 text-red-600" onClick={handleCancel} disabled={busy}>
            Cancel Order
          </Button>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="h-10" onClick={() => documentContext && generateInvoicePdf(documentContext)}>
            <FileText className="size-4" />
            Print Invoice
          </Button>
          <Button variant="outline" className="h-10" onClick={() => documentContext && generateShippingLabelPdf(documentContext)}>
            <FileDown className="size-4" />
            Shipping Label
          </Button>
          <Button variant="outline" className="h-10" onClick={() => documentContext && generatePackingSlipPdf(documentContext)}>
            <Package className="size-4" />
            Packing Slip
          </Button>
          <Button variant="outline" className="h-10" onClick={handleGenerateQr}>
            <QrCode className="size-4" />
            QR Code
          </Button>
          <Button variant="outline" className="h-10" onClick={handleGenerateBarcode}>
            <BarcodeIcon className="size-4" />
            Barcode
          </Button>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Customer Details */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <MapPin className="size-4 text-green-700" />
            Customer Details
          </h2>
          <p className="mt-3 font-semibold text-black">{order.shippingAddress.fullName}</p>
          <p className="mt-2 text-sm text-[#444444]">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
            {order.shippingAddress.landmark && (
              <>
                <br />
                Landmark: {order.shippingAddress.landmark}
              </>
            )}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
          </p>
          <p className="mt-3 text-xs text-[#888888]">
            Phone and email are never shown to sellers — courier handoff carries the address only.
          </p>

          {/* Courier Details */}
          <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <Truck className="size-4 text-green-700" />
            Courier Details
          </h2>
          {!mine.courierPartner ? (
            <p className="mt-3 text-sm text-[#444444]">No courier assigned yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Courier Partner" value={mine.courierPartner} />
              {mine.pickupDate && <Row label="Pickup Date" value={mine.pickupDate} />}
              {mine.pickupTime && <Row label="Pickup Time" value={mine.pickupTime} />}
              {mine.trackingNumber && <Row label="Tracking Number (AWB)" value={mine.trackingNumber} />}
              <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
                <CourierMilestone label="Courier Assigned" done={!!mine.courierPartner} />
                <CourierMilestone label="Pickup Scheduled" done={!!mine.pickupDate} />
                <CourierMilestone label="Picked Up Successfully" done={ORDER_FULFILMENT_SEQUENCE.indexOf(status) >= ORDER_FULFILMENT_SEQUENCE.indexOf("Picked Up")} />
              </div>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Order Details</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Row label="Order Date & Time" value={new Date(order.createdAt).toLocaleString()} />
              <Row label="Payment Status" value={order.paymentStatus} />
              <Row label="Payment Method" value={order.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"} />
            </div>

            <div className="mt-4 flex flex-col divide-y divide-border border-t border-border">
              {mine.items.map((item) => {
                const product = getProductById(item.productId)
                return (
                  <div key={item.productId} className="flex items-center gap-3 py-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                      <Image src={product?.image || "/placeholder.svg"} alt={product?.name ?? item.productId} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-black">{product?.name ?? item.productId}</p>
                      <p className="text-xs text-[#888888]">SKU: {item.productId}</p>
                      <p className="text-xs text-[#444444]">
                        Qty {item.quantity}
                        {item.originalPrice !== undefined && item.originalPrice > item.price && (
                          <span className="ml-2 line-through">{formatPrice(item.originalPrice)}</span>
                        )}
                        <span className="ml-2 font-semibold text-black">{formatPrice(item.price)}</span>
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-black">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <Row label="Seller Earnings" value={formatPrice(mine.payoutAmount)} bold />
              <Row label="Platform Commission" value={formatPrice(mine.commissionAmount)} />
              <Row label="Delivery Charge" value={formatPrice(order.totals.shipping)} />
              <Row label="Total Amount" value={formatPrice(order.totals.total)} bold />
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
              <CalendarClock className="size-4 text-green-700" />
              Tracking Timeline
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {(mine.timeline ?? []).length === 0 ? (
                <p className="text-sm text-[#444444]">No status changes yet.</p>
              ) : (
                mine.timeline!.map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {status === "Cancelled" && event.status === "Cancelled" ? (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-black">{event.status}</p>
                      <p className="text-xs text-[#888888]">{new Date(event.at).toLocaleString()}</p>
                      {event.note && <p className="text-xs text-[#444444]">{event.note}</p>}
                    </div>
                  </div>
                ))
              )}
              {status !== "Cancelled" &&
                status !== "Returned" &&
                ["Order Confirmed", ...ORDER_FULFILMENT_SEQUENCE.slice(1)]
                  .filter((label) => !(mine.timeline ?? []).some((e) => e.status === label || (label === "Order Confirmed" && e.status === "Pending")))
                  .map((label) => (
                    <div key={label} className="flex items-start gap-3 opacity-40">
                      <Circle className="mt-0.5 size-4 shrink-0 text-[#888888]" />
                      <p className="text-sm text-[#444444]">{label}</p>
                    </div>
                  ))}
            </div>
          </div>
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

      {/* Schedule pickup dialog */}
      <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
        <DialogContent>
          <DialogTitle>Schedule Pickup</DialogTitle>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Courier Partner</Label>
              <select
                value={courierPartner}
                onChange={(e) => setCourierPartner(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickup-date">Pickup Date</Label>
                <Input id="pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickup-time">Pickup Time</Label>
                <Input id="pickup-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="h-10" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="awb">Tracking Number / AWB (optional)</Label>
              <Input id="awb" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="h-10" />
            </div>
            <Button className="h-10" onClick={handleConfirmPickup} disabled={busy}>
              Confirm Pickup Schedule
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#444444]">{label}</span>
      <span className={bold ? "font-semibold text-black" : "text-black"}>{value}</span>
    </div>
  )
}

function CourierMilestone({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle2 className="size-4 text-green-600" /> : <Circle className="size-4 text-[#888888]" />}
      <span className={done ? "text-black" : "text-[#888888]"}>{label}</span>
    </div>
  )
}
