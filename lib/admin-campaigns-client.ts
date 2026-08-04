import { auth } from "@/services/firebase/client"
import type { Campaign, CampaignInput, CampaignParticipant } from "@/types/campaign"

/** status and createdBy are always computed server-side (see
 * app/api/admin/campaigns/route.ts) — the client never sends them. */
export type CreateCampaignInput = Omit<CampaignInput, "status" | "createdBy">

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function parseResult<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Request failed." }
  return { ok: true, data: body as T }
}

export async function fetchCampaigns(): Promise<{ ok: true; campaigns: Campaign[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/campaigns", { headers })
  const result = await parseResult<{ campaigns: Campaign[] }>(response)
  if (!result.ok) return result
  return { ok: true, campaigns: result.data.campaigns }
}

export async function fetchCampaign(id: string): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/campaigns/${id}`, { headers })
  const result = await parseResult<{ campaign: Campaign }>(response)
  if (!result.ok) return result
  return { ok: true, campaign: result.data.campaign }
}

export async function createCampaign(input: CreateCampaignInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/campaigns", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ id: string }>(response)
  if (!result.ok) return result
  return { ok: true, id: result.data.id }
}

export async function updateCampaign(
  id: string,
  patch: Partial<CampaignInput>,
): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/campaigns/${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ campaign: Campaign }>(response)
  if (!result.ok) return result
  return { ok: true, campaign: result.data.campaign }
}

export async function deleteCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE", headers })
  return parseResult<{ ok: true }>(response)
}

export async function inviteSellersToCampaign(
  id: string,
  sellerIds: string[],
): Promise<{ ok: true; invited: number } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/campaigns/${id}/invite`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sellerIds }),
  })
  const result = await parseResult<{ invited: number }>(response)
  if (!result.ok) return result
  return { ok: true, invited: result.data.invited }
}

export async function fetchCampaignParticipants(
  id: string,
): Promise<{ ok: true; participants: CampaignParticipant[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/campaigns/${id}/participants`, { headers })
  const result = await parseResult<{ participants: CampaignParticipant[] }>(response)
  if (!result.ok) return result
  return { ok: true, participants: result.data.participants }
}
