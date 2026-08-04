import { auth } from "@/services/firebase/client"
import type { DashboardStats } from "@/types/dashboard-stats"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}` }
}

export async function fetchDashboardStats(): Promise<{ ok: true; stats: DashboardStats } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/dashboard/stats", { headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Failed to load dashboard stats." }
  return { ok: true, stats: body as DashboardStats }
}
