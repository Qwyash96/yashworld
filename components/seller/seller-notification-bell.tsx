"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { getUserProfile } from "@/services/user.service"
import type { SellerNotification } from "@/types/seller-notification"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/** Live (onSnapshot) seller alert bell — the fulfillment-dashboard
 * equivalent of components/admin/admin-notification-bell.tsx, targeted by
 * uid instead of admin permission (types/seller-notification.ts). */
export function SellerNotificationBell({ sellerId }: { sellerId: string }) {
  const [notifications, setNotifications] = useState<SellerNotification[]>([])
  const [readAt, setReadAt] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getUserProfile(sellerId).then((profile) => setReadAt(profile?.sellerNotificationsReadAt ?? new Date(0).toISOString()))
  }, [sellerId])

  useEffect(() => {
    const q = query(
      collection(db, "sellerNotifications"),
      where("sellerId", "==", sellerId),
      orderBy("createdAt", "desc"),
      limit(50),
    )
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SellerNotification))
    })
  }, [sellerId])

  const unreadCount = readAt ? notifications.filter((n) => n.createdAt > readAt).length : notifications.length

  async function markAllRead() {
    const now = new Date().toISOString()
    setReadAt(now)
    await updateDoc(doc(db, "users", sellerId), { sellerNotificationsReadAt: now })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllRead() }}>
      <SheetTrigger aria-label="Notifications" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-black hover:bg-green-50">
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col divide-y divide-border">
          {notifications.length === 0 && <p className="p-5 text-sm text-[#444444]">No notifications yet.</p>}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.relatedType === "order" ? `/seller/orders/${n.relatedId}` : "/seller/orders"}
              onClick={() => setOpen(false)}
              className="block p-4 hover:bg-green-50"
            >
              <p className="text-sm font-medium text-black">{n.title}</p>
              <p className="mt-0.5 text-sm text-[#444444]">{n.message}</p>
              <p className="mt-1 text-xs text-[#888888]">{new Date(n.createdAt).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
