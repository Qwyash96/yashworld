"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { getPermissionsForRole, isAdminRole } from "@/lib/admin-roles"
import type { AdminNotification } from "@/types/notification"
import { Button } from "@/components/ui/button"

const PAGE_SIZE = 50

export default function AdminNotificationsPage() {
  const admin = useAdminAuth()
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const permissions = isAdminRole(admin.role) ? getPermissionsForRole(admin.role) : []

  useEffect(() => {
    if (permissions.length === 0) return
    const q = query(
      collection(db, "notifications"),
      where("targetPermission", "in", permissions),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminNotification))
      setHasMore(snap.docs.length === PAGE_SIZE)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.role])

  async function loadMore() {
    const last = notifications[notifications.length - 1]
    if (!last) return
    setLoadingMore(true)
    const q = query(
      collection(db, "notifications"),
      where("targetPermission", "in", permissions),
      orderBy("createdAt", "desc"),
      startAfter(last.createdAt),
      limit(PAGE_SIZE),
    )
    const snap = await getDocs(q)
    setNotifications((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminNotification)])
    setHasMore(snap.docs.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Bell className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Notifications</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every event relevant to your role — the top 50 update live.</p>

      <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-white shadow-sm">
        {notifications.length === 0 && <p className="p-8 text-center text-sm text-[#444444]">No notifications yet.</p>}
        {notifications.map((n) => (
          <div key={n.id} className="p-4">
            <p className="text-sm font-medium text-black">{n.title}</p>
            <p className="mt-0.5 text-sm text-[#444444]">{n.message}</p>
            <p className="mt-1 text-xs text-[#888888]">{new Date(n.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {hasMore && notifications.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" className="h-9" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading..." : "Load Earlier"}
          </Button>
        </div>
      )}
    </div>
  )
}
