"use client"

import { useEffect, useState } from "react"
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { fetchDashboardStats } from "@/lib/admin-dashboard-client"
import type { DashboardStats, RecentOrderSummary, RecentRegistration } from "@/types/dashboard-stats"
import type { UserProfile } from "@/types/user"
import type { Order } from "@/types/order"

const REFRESH_INTERVAL_MS = 20_000
const ONLINE_WINDOW_MS = 5 * 60_000

/**
 * The hybrid real-time strategy for the admin dashboard: `stats` (every
 * aggregate/fetch-and-reduce tile) refetches on a plain interval timer —
 * Firestore aggregation queries can't be listened to live at all. Recent
 * Orders, Recent Registrations, and Online Users are small, bounded raw
 * queries held open as real onSnapshot listeners instead.
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([])
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([])
  const [onlineUsers, setOnlineUsers] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const result = await fetchDashboardStats()
      if (cancelled) return
      if (!result.ok) {
        setStatsError(result.error)
        return
      }
      setStatsError(null)
      setStats(result.stats)
    }
    refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5))
    return onSnapshot(q, (snap) => {
      setRecentOrders(
        snap.docs.map((d) => {
          const order = d.data() as Order
          return { id: d.id, buyerId: order.buyerId, contactEmail: order.contactEmail, total: order.totals.total, createdAt: order.createdAt }
        }),
      )
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))
    return onSnapshot(q, (snap) => {
      setRecentRegistrations(
        snap.docs.map((d) => {
          const u = d.data() as UserProfile
          return { uid: d.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }
        }),
      )
    })
  }, [])

  useEffect(() => {
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
    const q = query(collection(db, "presence"), where("lastSeenAt", ">=", cutoff), limit(500))
    return onSnapshot(q, (snap) => setOnlineUsers(snap.size))
  }, [])

  return { stats, statsError, recentOrders, recentRegistrations, onlineUsers, loading: stats === null && !statsError }
}
