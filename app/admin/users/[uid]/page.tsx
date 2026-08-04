"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ShieldBan, ShieldCheck, Ban, Mail, Phone } from "lucide-react"
import { collection, getDocs, orderBy, query, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { fetchBuyerDetail, suspendBuyer, banBuyer, activateBuyer, verifyBuyerEmail, verifyBuyerPhone } from "@/lib/admin-users-client"
import { getOrdersByBuyer } from "@/services/order.service"
import { formatPrice } from "@/lib/products"
import type { UserProfile } from "@/types/user"
import type { Order } from "@/types/order"
import type { LoginHistoryEntry } from "@/types/login-history"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"

const TABS = ["Profile", "Orders", "Addresses", "Login History", "Activity", "Wishlist", "Cart", "Reviews"] as const
type Tab = (typeof TABS)[number]

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-yellow-100 text-yellow-800",
  banned: "bg-red-100 text-red-700",
}

export default function AdminUserDetailPage() {
  const params = useParams<{ uid: string }>()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [logins, setLogins] = useState<LoginHistoryEntry[] | null>(null)
  const [tab, setTab] = useState<Tab>("Profile")

  function refresh() {
    fetchBuyerDetail(params.uid).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setUser(result.user)
    })
  }

  useEffect(() => {
    refresh()
    getOrdersByBuyer(params.uid).then(setOrders)
    const q = query(collection(db, "loginHistory"), where("uid", "==", params.uid), orderBy("at", "desc"))
    getDocs(q).then((snap) => setLogins(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoginHistoryEntry)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.uid])

  async function handleAction(action: "suspend" | "ban" | "activate") {
    const fn = action === "suspend" ? suspendBuyer : action === "ban" ? banBuyer : activateBuyer
    const result = await fn(params.uid)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Buyer ${action === "activate" ? "reactivated" : action + "ed"}.`)
    refresh()
  }

  async function handleVerify(kind: "email" | "phone") {
    const result = await (kind === "email" ? verifyBuyerEmail(params.uid) : verifyBuyerPhone(params.uid))
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${kind === "email" ? "Email" : "Phone"} marked verified.`)
    refresh()
  }

  if (!user) return null
  const status = user.status ?? "active"

  const activityEvents = [
    { label: "Account created", at: user.createdAt },
    ...(user.lastLoginAt ? [{ label: "Last login", at: user.lastLoginAt }] : []),
    ...(logins ?? []).map((l) => ({ label: "Signed in", at: l.at })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  return (
    <div>
      <Link href="/admin/users" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Buyers
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-black">{user.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>{status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {status !== "active" && (
            <Button size="sm" variant="outline" className="h-9" onClick={() => handleAction("activate")}>
              <ShieldCheck className="size-3.5" />
              {status === "banned" ? "Unban" : "Unsuspend"}
            </Button>
          )}
          {status !== "suspended" && (
            <Button size="sm" variant="outline" className="h-9" onClick={() => handleAction("suspend")}>
              <ShieldBan className="size-3.5" />
              Suspend
            </Button>
          )}
          {status !== "banned" && (
            <Button size="sm" variant="destructive" className="h-9" onClick={() => handleAction("ban")}>
              <Ban className="size-3.5" />
              Ban
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
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

      <div className="mt-6">
        {tab === "Profile" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Email" value={user.email}>
              <Button size="sm" variant="outline" className="h-8" disabled={!!user.emailVerified} onClick={() => handleVerify("email")}>
                <Mail className="size-3.5" />
                {user.emailVerified ? "Verified" : "Verify Email"}
              </Button>
            </InfoCard>
            <InfoCard label="Mobile" value={user.mobile ?? "Not provided"}>
              {user.mobile && (
                <Button size="sm" variant="outline" className="h-8" disabled={!!user.phoneVerified} onClick={() => handleVerify("phone")}>
                  <Phone className="size-3.5" />
                  {user.phoneVerified ? "Verified" : "Verify Phone"}
                </Button>
              )}
            </InfoCard>
            <InfoCard label="Registered" value={new Date(user.createdAt).toLocaleString()} />
            <InfoCard label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never recorded"} />
          </div>
        )}

        {tab === "Orders" && (
          <div className="flex flex-col gap-2">
            {orders === null ? (
              <p className="text-sm text-[#444444]">Loading...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-[#444444]">No orders yet.</p>
            ) : (
              orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm hover:bg-green-50"
                >
                  <span className="text-black">Order #{order.id.slice(0, 8)} — {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-black">{formatPrice(order.totals.total)}</span>
                    <OrderStatusBadge status={order.status} />
                  </span>
                </Link>
              ))
            )}
          </div>
        )}

        {tab === "Addresses" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {user.addresses.length === 0 ? (
              <p className="text-sm text-[#444444]">No addresses saved.</p>
            ) : (
              user.addresses.map((addr) => (
                <div key={addr.id} className="rounded-xl border border-border bg-white p-4 text-sm shadow-sm">
                  <p className="font-medium text-black">{addr.fullName}</p>
                  <p className="text-[#444444]">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} {addr.postalCode}
                  </p>
                  <p className="text-[#444444]">{addr.phone}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Login History" && (
          <div className="flex flex-col gap-2">
            {logins === null ? (
              <p className="text-sm text-[#444444]">Loading...</p>
            ) : logins.length === 0 ? (
              <p className="text-sm text-[#444444]">No recorded logins yet.</p>
            ) : (
              logins.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                  <span className="text-black">{new Date(l.at).toLocaleString()}</span>
                  <span className="text-xs text-[#444444]">{l.method} {l.userAgent ? `· ${l.userAgent.slice(0, 60)}` : ""}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Activity" && (
          <div className="flex flex-col gap-2">
            {activityEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm shadow-sm">
                <span className="text-black">{e.label}</span>
                <span className="text-xs text-[#444444]">{new Date(e.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Wishlist" && (
          <EmptyFeatureNote text="Wishlist items are stored only in this buyer's browser (localStorage) and are never synced to our servers, so there's nothing to show here." />
        )}
        {tab === "Cart" && (
          <EmptyFeatureNote text="Cart items are stored only in this buyer's browser (localStorage) and are never synced to our servers, so there's nothing to show here." />
        )}
        {tab === "Reviews" && <EmptyFeatureNote text="Review submission hasn't been built yet — there's nothing to show here." />}
      </div>
    </div>
  )
}

function InfoCard({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#888888]">{label}</p>
        <p className="mt-1 text-sm font-medium text-black">{value}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyFeatureNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border bg-[#f8f8f2] p-4 text-sm text-[#444444]">{text}</p>
}
