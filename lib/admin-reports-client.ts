import { auth } from "@/services/firebase/client"
import type { ReportsData } from "@/types/reports"

export async function fetchReports(from?: string, to?: string): Promise<{ ok: true; data: ReportsData } | { ok: false; error: string }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)

  const response = await fetch(`/api/admin/reports?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Failed to load reports." }
  return { ok: true, data: body as ReportsData }
}
