import { auth } from "@/services/firebase/client"

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

export async function approveSeller(uid: string): Promise<{ ok: true; sellerId: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/sellers/${uid}/approve`, { method: "POST", headers })
  const result = await parseResult<{ sellerId: string }>(response)
  if (!result.ok) return result
  return { ok: true, sellerId: result.data.sellerId }
}

async function reasonAction(
  uid: string,
  route: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/sellers/${uid}/${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason }),
  })
  return parseResult<{ ok: true }>(response)
}

export async function rejectSeller(uid: string, reason: string) {
  return reasonAction(uid, "reject", reason)
}

export async function requestSellerReupload(uid: string, reason: string) {
  return reasonAction(uid, "request-reupload", reason)
}

export async function suspendSeller(uid: string, reason: string) {
  return reasonAction(uid, "suspend", reason)
}

export async function banSeller(uid: string, reason: string) {
  return reasonAction(uid, "ban", reason)
}

export async function getSellerDocumentUrl(
  uid: string,
  docKey: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/sellers/${uid}/documents/${docKey}`, { headers })
  const result = await parseResult<{ url: string }>(response)
  if (!result.ok) return result
  return { ok: true, url: result.data.url }
}
