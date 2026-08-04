"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { getUserProfile } from "@/services/user.service"
import { getPermissionsForRole, isAdminRole } from "@/lib/admin-roles"
import type { AdminNotification } from "@/types/notification"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

/** Live (onSnapshot) admin alert bell — one of the deliberate hybrid-strategy
 * exceptions, since this is a small, bounded (limit 50) query. */
export function AdminNotificationBell() {
  const admin = useAdminAuth()
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [readAt, setReadAt] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getUserProfile(admin.uid).then((profile) => setReadAt(profile?.notificationsReadAt ?? new Date(0).toISOString()))
  }, [admin.uid])

  useEffect(() => {
    if (!isAdminRole(admin.role)) return
    const permissions = getPermissionsForRole(admin.role)
    if (permissions.length === 0) return
    const q = query(
      collection(db, "notifications"),
      where("targetPermission", "in", permissions),
      orderBy("createdAt", "desc"),
      limit(50),
    )
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminNotification))
    })
  }, [admin.role])

  const unreadCount = readAt ? notifications.filter((n) => n.createdAt > readAt).length : notifications.length

  async function markAllRead() {
    const now = new Date().toISOString()
    setReadAt(now)
    await updateDoc(doc(db, "users", admin.uid), { notificationsReadAt: now })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllRead() }}>
      <SheetTrigger aria-label="Notifications" className="relative rounded-xl border border-border p-2 text-black hover:bg-green-50">
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
            <div key={n.id} className="p-4">
              <p className="text-sm font-medium text-black">{n.title}</p>
              <p className="mt-0.5 text-sm text-[#444444]">{n.message}</p>
              <p className="mt-1 text-xs text-[#888888]">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="p-4">
          <Button variant="outline" size="sm" className="h-9 w-full" render={<Link href="/admin/notifications" />}>
            View All
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
