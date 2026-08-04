import { auth } from "@/services/firebase/client"
import type { AdminRole } from "@/lib/admin-roles"
import type { UserProfile } from "@/types/user"
import type { StaffInvite } from "@/types/staff-invite"

export interface InviteStaffInput {
  email: string
  role: AdminRole
  mobile?: string
  department?: string
}

export interface UpdateStaffInput {
  fullName: string
  email: string
  mobile: string
  department: string
  role: AdminRole
}

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

export async function fetchStaffList(): Promise<
  { ok: true; staff: UserProfile[]; invites: StaffInvite[] } | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/staff", { headers })
  const result = await parseResult<{ staff: UserProfile[]; invites: StaffInvite[] }>(response)
  if (!result.ok) return result
  return { ok: true, staff: result.data.staff, invites: result.data.invites }
}

/** Invites a staff member by Gmail + role — no password (Google Login only).
 * If that email already has an account, it's promoted immediately; otherwise
 * a pending invite is created and consumed on their first Google sign-in. */
export async function inviteStaffMember(
  input: InviteStaffInput,
): Promise<{ ok: true; status: "activated" | "invited" } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/staff", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ status: "activated" | "invited" }>(response)
  if (!result.ok) return result
  return { ok: true, status: result.data.status }
}

export async function updateStaffAccount(
  uid: string,
  input: UpdateStaffInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/${uid}`, { method: "PATCH", headers, body: JSON.stringify(input) })
  return parseResult<{ ok: true }>(response)
}

export async function deleteStaffAccount(uid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/${uid}`, { method: "DELETE", headers })
  return parseResult<{ ok: true }>(response)
}

export async function suspendStaffAccount(uid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/${uid}/suspend`, { method: "POST", headers })
  return parseResult<{ ok: true }>(response)
}

export async function activateStaffAccount(uid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/${uid}/activate`, { method: "POST", headers })
  return parseResult<{ ok: true }>(response)
}

export async function updateInviteRole(
  email: string,
  role: AdminRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/invites/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ role }),
  })
  return parseResult<{ ok: true }>(response)
}

export async function cancelInvite(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/staff/invites/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers,
  })
  return parseResult<{ ok: true }>(response)
}
