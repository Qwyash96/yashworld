"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Loader2, AlertTriangle } from "lucide-react"
import { getSellerApplication, getSellerProfile } from "@/services/seller.service"
import { getProductsBySeller } from "@/services/product.service"
import { getOrdersBySeller } from "@/services/order.service"
import {
  approveSeller,
  rejectSeller,
  requestSellerReupload,
  suspendSeller,
  banSeller,
  getSellerDocumentUrl,
} from "@/lib/admin-sellers-client"
import { fetchSellerWallet, approveWithdrawal, rejectWithdrawal, markWithdrawalPaid } from "@/lib/admin-seller-wallet-client"
import { formatPrice } from "@/lib/products"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { hasPermission, isAdminRole } from "@/lib/admin-roles"
import type { Seller, SellerApplication, SellerApplicationStatus } from "@/types/seller"
import type { Product } from "@/types/product"
import type { Order } from "@/types/order"
import type { SellerWallet, WithdrawalRequest } from "@/types/wallet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const TABS = ["Overview", "Products", "Orders", "Revenue", "Withdrawals", "Commission", "Performance"] as const
type SellerTab = (typeof TABS)[number]

const statusStyles: Record<SellerApplicationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  resubmission_requested: "bg-orange-100 text-orange-700",
  suspended: "bg-gray-200 text-gray-700",
  banned: "bg-red-200 text-red-900",
}

const statusLabels: Record<SellerApplicationStatus, string> = {
  pending: "pending",
  approved: "Active",
  rejected: "rejected",
  resubmission_requested: "re-upload requested",
  suspended: "suspended",
  banned: "banned",
}

type ReasonAction = "reject" | "reupload" | "suspend" | "ban"

const reasonActionCopy: Record<ReasonAction, { title: string; placeholder: string; confirmLabel: string; toast: string }> = {
  reject: {
    title: "Reject application",
    placeholder: "Explain why this application is being rejected...",
    confirmLabel: "Confirm Rejection",
    toast: "Seller application rejected.",
  },
  reupload: {
    title: "Request re-upload",
    placeholder: "Explain what needs to be corrected or re-uploaded...",
    confirmLabel: "Send Re-upload Request",
    toast: "Re-upload requested.",
  },
  suspend: {
    title: "Suspend seller",
    placeholder: "Explain why this seller is being suspended...",
    confirmLabel: "Confirm Suspension",
    toast: "Seller suspended.",
  },
  ban: {
    title: "Ban seller",
    placeholder: "Explain why this seller is being permanently banned...",
    confirmLabel: "Confirm Ban",
    toast: "Seller banned.",
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function AdminSellerDetailPage() {
  const params = useParams<{ id: string }>()
  const admin = useAdminAuth()
  const [application, setApplication] = useState<SellerApplication | null | undefined>(undefined)
  const [activeAction, setActiveAction] = useState<ReasonAction | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<SellerTab>("Overview")

  const [products, setProducts] = useState<Product[] | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [wallet, setWallet] = useState<SellerWallet | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null)
  const [sellerProfile, setSellerProfile] = useState<Seller | null>(null)

  const canViewPayments = admin.role === "super_admin" || (isAdminRole(admin.role) && hasPermission(admin.role, "payments"))

  function refresh() {
    getSellerApplication(params.id).then(setApplication)
  }

  useEffect(() => {
    refresh()
    getProductsBySeller(params.id).then(setProducts)
    getOrdersBySeller(params.id).then(setOrders)
    getSellerProfile(params.id).then(setSellerProfile)
    if (canViewPayments) {
      fetchSellerWallet(params.id).then((result) => {
        if (result.ok) {
          setWallet(result.wallet)
          setWithdrawals(result.withdrawals)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function handleWithdrawalAction(action: "approve" | "reject" | "mark-paid", id: string) {
    const fn = action === "approve" ? approveWithdrawal : action === "reject" ? rejectWithdrawal : markWithdrawalPaid
    const result = await fn(id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Withdrawal ${action === "mark-paid" ? "marked paid" : action + "d"}.`)
    fetchSellerWallet(params.id).then((r) => {
      if (r.ok) {
        setWallet(r.wallet)
        setWithdrawals(r.withdrawals)
      }
    })
  }

  if (application === undefined) return null
  if (application === null) {
    return (
      <div className="p-8 text-center">
        <p className="text-black">Seller not found.</p>
        <Link href="/admin/sellers" className="mt-4 inline-block text-green-700 hover:underline">
          Back to Seller Management
        </Link>
      </div>
    )
  }

  async function approve() {
    setBusy(true)
    const result = await approveSeller(application!.uid)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Seller approved — ID ${result.sellerId}`)
    refresh()
  }

  async function confirmReasonAction() {
    if (!reason.trim()) {
      toast.error("Please provide a reason.")
      return
    }
    if (!activeAction) return
    setBusy(true)
    const fn = { reject: rejectSeller, reupload: requestSellerReupload, suspend: suspendSeller, ban: banSeller }[
      activeAction
    ]
    const result = await fn(application!.uid, reason.trim())
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(reasonActionCopy[activeAction].toast)
    setActiveAction(null)
    setReason("")
    refresh()
  }

  function startAction(action: ReasonAction) {
    setActiveAction((current) => (current === action ? null : action))
    setReason("")
  }

  return (
    <div>
      <Link
        href="/admin/sellers"
        className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Seller Management
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">{application.shopName}</h1>
          {application.sellerId && (
            <p className="text-sm font-semibold text-green-700">{application.sellerId}</p>
          )}
          <p className="text-xs text-[#444444]">Submitted: {formatDate(application.createdAt)}</p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[application.status]}`}
        >
          {statusLabels[application.status]}
        </span>
      </div>

      {(application.status === "rejected" ||
        application.status === "resubmission_requested" ||
        application.status === "suspended" ||
        application.status === "banned") &&
        application.rejectionReason && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <strong>Reason:</strong> {application.rejectionReason}
          </div>
        )}

      {application.accountHolderNameMismatch && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            The bank account holder name (&quot;{application.payoutInfo.accountHolder}&quot;) doesn&apos;t match the
            registered full name (&quot;{application.fullName}&quot;). Please verify manually before approving.
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.filter((t) => t !== "Withdrawals" || canViewPayments).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-green-600 text-white" : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
      <>
      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {application.status === "pending" && (
          <>
            <Button className="h-10" onClick={approve} disabled={busy}>
              Approve
            </Button>
            <Button variant="outline" className="h-10" onClick={() => startAction("reject")} disabled={busy}>
              Reject
            </Button>
            <Button variant="outline" className="h-10" onClick={() => startAction("reupload")} disabled={busy}>
              Request Re-upload
            </Button>
          </>
        )}
        {application.status === "approved" && (
          <>
            <Button variant="outline" className="h-10" onClick={() => startAction("suspend")} disabled={busy}>
              Suspend
            </Button>
            <Button variant="destructive" className="h-10" onClick={() => startAction("ban")} disabled={busy}>
              Ban
            </Button>
          </>
        )}
        {application.status === "suspended" && (
          <>
            <Button className="h-10" onClick={approve} disabled={busy}>
              Reactivate
            </Button>
            <Button variant="destructive" className="h-10" onClick={() => startAction("ban")} disabled={busy}>
              Ban
            </Button>
          </>
        )}
        {application.status === "banned" && (
          <Button className="h-10" onClick={approve} disabled={busy}>
            Reactivate
          </Button>
        )}
      </div>

      {activeAction && (
        <div className="mt-4 rounded-xl border border-border bg-[#f3f5f2] p-4">
          <Label htmlFor="actionReason">{reasonActionCopy[activeAction].title}</Label>
          <textarea
            id="actionReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 h-24 w-full rounded-lg border border-border bg-white p-3 text-sm text-black outline-none focus:border-primary"
            placeholder={reasonActionCopy[activeAction].placeholder}
          />
          <Button className="mt-3 h-10" onClick={confirmReasonAction} disabled={busy}>
            {reasonActionCopy[activeAction].confirmLabel}
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DetailCard title="Personal Details">
          <DetailRow label="Full Name" value={application.fullName} />
          <DetailRow
            label="Mobile"
            value={`${application.mobile}${application.mobileVerified ? " (verified)" : ""}`}
          />
        </DetailCard>

        <DetailCard title="Identity">
          <DetailRow label="PAN Number" value={application.panNumber} />
          <DetailRow label="Aadhaar Number" value={application.aadhaarNumber} />
        </DetailCard>

        <DetailCard title="Business Details">
          <DetailRow label="Shop Name" value={application.shopName} />
          <DetailRow label="Business Type" value={application.businessType} />
          <DetailRow label="GST Number" value={application.gstNumber} />
          <DetailRow label="Address" value={application.address} />
          <DetailRow label="City" value={application.city} />
          <DetailRow label="State" value={application.state} />
          <DetailRow label="Pincode" value={application.pincode} />
        </DetailCard>

        <DetailCard title="Bank Details">
          <DetailRow label="Account Holder" value={application.payoutInfo.accountHolder} />
          <DetailRow label="Bank Name" value={application.payoutInfo.bankName} />
          <DetailRow label="Account Number" value={application.payoutInfo.accountNumber} />
          <DetailRow label="IFSC Code" value={application.payoutInfo.ifsc} />
        </DetailCard>

        <DetailCard title="Uploaded Documents">
          <DocRow uid={application.uid} docKey="aadhaarFront" label="Aadhaar Front" path={application.kyc.aadhaarFrontPath} />
          <DocRow uid={application.uid} docKey="aadhaarBack" label="Aadhaar Back" path={application.kyc.aadhaarBackPath} />
          <DocRow uid={application.uid} docKey="pan" label="PAN" path={application.kyc.panPath} />
          <DocRow uid={application.uid} docKey="selfie" label="Live Selfie" path={application.kyc.selfiePath} />
          <DocRow uid={application.uid} docKey="bankProof" label="Bank Proof" path={application.kyc.bankProofPath} />
          <DocRow uid={application.uid} docKey="gst" label="GST Certificate" path={application.kyc.gstPath} />
        </DetailCard>

        {application.moderationHistory && application.moderationHistory.length > 0 && (
          <DetailCard title="Moderation History">
            {[...application.moderationHistory].reverse().map((event, i) => (
              <div key={i} className="border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize text-black">{event.action.replace("_", " ")}</span>
                  <span className="text-xs text-[#444444]">{formatDate(event.at)}</span>
                </div>
                {event.reason && <p className="mt-0.5 text-xs text-[#444444]">{event.reason}</p>}
              </div>
            ))}
          </DetailCard>
        )}
      </div>
      </>
      )}

      {tab === "Products" && (
        <div className="mt-6 flex flex-col gap-2">
          {products === null ? (
            <p className="text-sm text-[#444444]">Loading...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-[#444444]">No products listed yet.</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                <span className="text-black">{p.name}</span>
                <span className="flex items-center gap-3 text-[#444444]">
                  <span>{formatPrice(p.price)}</span>
                  <span>{p.stock} in stock</span>
                  <span className="capitalize">{p.status}</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Orders" && (
        <div className="mt-6 flex flex-col gap-2">
          {orders === null ? (
            <p className="text-sm text-[#444444]">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-[#444444]">No orders yet.</p>
          ) : (
            orders.map((order) => {
              const mine = order.sellerOrders.find((so) => so.sellerId === params.id)
              if (!mine) return null
              return (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                  <span className="text-black">Order #{order.id.slice(0, 8)} — {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-black">
                      {formatPrice(mine.items.reduce((s, i) => s + i.price * i.quantity, 0))}
                    </span>
                    <span className="capitalize text-[#444444]">{mine.status}</span>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "Revenue" && (
        <SellerRevenuePanel orders={orders} sellerId={params.id} />
      )}

      {tab === "Withdrawals" && (
        <div className="mt-6">
          {!canViewPayments ? (
            <p className="text-sm text-[#444444]">You don't have permission to view payment/withdrawal data.</p>
          ) : wallet === null ? (
            <p className="text-sm text-[#444444]">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-[#888888]">Available Balance</p>
                  <p className="mt-1 text-xl font-bold text-black">{formatPrice(wallet.balance)}</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-[#888888]">On Hold</p>
                  <p className="mt-1 text-xl font-bold text-black">{formatPrice(wallet.pendingBalance)}</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-[#888888]">Lifetime Withdrawn</p>
                  <p className="mt-1 text-xl font-bold text-black">{formatPrice(wallet.lifetimeWithdrawn)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {withdrawals && withdrawals.length === 0 && <p className="text-sm text-[#444444]">No withdrawal requests yet.</p>}
                {withdrawals?.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                    <span className="text-black">
                      {formatPrice(w.amount)} — requested {new Date(w.requestedAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge status={w.status} />
                      {w.status === "requested" && (
                        <>
                          <Button size="sm" className="h-8" onClick={() => handleWithdrawalAction("approve", w.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleWithdrawalAction("reject", w.id)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {w.status === "approved" && (
                        <Button size="sm" className="h-8" onClick={() => handleWithdrawalAction("mark-paid", w.id)}>
                          Mark Paid
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Commission" && (
        <div className="mt-6 flex flex-col gap-2">
          {orders === null ? (
            <p className="text-sm text-[#444444]">Loading...</p>
          ) : (
            orders.map((order) => {
              const mine = order.sellerOrders.find((so) => so.sellerId === params.id)
              if (!mine) return null
              return (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                  <span className="text-black">Order #{order.id.slice(0, 8)}</span>
                  <span className="flex items-center gap-3 text-[#444444]">
                    <span>Commission {formatPrice(mine.commissionAmount)}</span>
                    <span className="font-semibold text-black">Payout {formatPrice(mine.payoutAmount)}</span>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "Performance" && (
        <SellerPerformancePanel orders={orders} sellerId={params.id} ratingAvg={sellerProfile?.ratingAvg} ratingCount={sellerProfile?.ratingCount} />
      )}
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-700",
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? ""}`}>{status}</span>
}

function SellerRevenuePanel({ orders, sellerId }: { orders: Order[] | null; sellerId: string }) {
  if (orders === null) return <p className="mt-6 text-sm text-[#444444]">Loading...</p>
  const mine = orders
    .map((o) => o.sellerOrders.find((so) => so.sellerId === sellerId))
    .filter((so): so is NonNullable<typeof so> => !!so && so.status !== "Cancelled")
  const totalRevenue = mine.reduce((sum, so) => sum + so.items.reduce((s, i) => s + i.price * i.quantity, 0), 0)
  const totalPayout = mine.reduce((sum, so) => sum + so.payoutAmount, 0)

  return (
    <div className="mt-6 grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Total Revenue</p>
        <p className="mt-1 text-2xl font-bold text-black">{formatPrice(totalRevenue)}</p>
        <p className="mt-1 text-xs text-[#444444]">Across {mine.length} non-cancelled order(s)</p>
      </div>
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Total Payout (after commission)</p>
        <p className="mt-1 text-2xl font-bold text-black">{formatPrice(totalPayout)}</p>
      </div>
    </div>
  )
}

function SellerPerformancePanel({
  orders,
  sellerId,
  ratingAvg,
  ratingCount,
}: {
  orders: Order[] | null
  sellerId: string
  ratingAvg?: number
  ratingCount?: number
}) {
  if (orders === null) return <p className="mt-6 text-sm text-[#444444]">Loading...</p>
  const mine = orders.map((o) => o.sellerOrders.find((so) => so.sellerId === sellerId)).filter((so): so is NonNullable<typeof so> => !!so)
  const delivered = mine.filter((so) => so.status === "Delivered" || so.status === "Completed").length
  const cancelled = mine.filter((so) => so.status === "Cancelled").length
  const fulfilmentRate = mine.length > 0 ? Math.round((delivered / mine.length) * 100) : 0

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Total Orders</p>
        <p className="mt-1 text-2xl font-bold text-black">{mine.length}</p>
      </div>
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Fulfilment Rate</p>
        <p className="mt-1 text-2xl font-bold text-black">{fulfilmentRate}%</p>
      </div>
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Cancelled</p>
        <p className="mt-1 text-2xl font-bold text-black">{cancelled}</p>
      </div>
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#888888]">Rating</p>
        <p className="mt-1 text-2xl font-bold text-black">{ratingAvg ? ratingAvg.toFixed(1) : "—"}</p>
        <p className="text-xs text-[#444444]">{ratingCount ?? 0} review(s)</p>
      </div>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">{title}</h2>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#444444]">{label}</span>
      <span className="font-medium text-black">{value || "—"}</span>
    </div>
  )
}

function DocRow({ uid, docKey, label, path }: { uid: string; docKey: string; label: string; path?: string }) {
  const [loading, setLoading] = useState(false)

  async function view() {
    setLoading(true)
    const result = await getSellerDocumentUrl(uid, docKey)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#444444]">{label}</span>
      {path ? (
        <button
          type="button"
          onClick={view}
          disabled={loading}
          className="flex items-center gap-1.5 font-medium text-green-700 hover:underline disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          View Document
        </button>
      ) : (
        <span className="text-[#444444]">Not provided</span>
      )}
    </div>
  )
}
