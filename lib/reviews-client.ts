import { auth } from "@/services/firebase/client"
import type { Review } from "@/types/review"

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

export async function submitReview(input: {
  orderId: string
  productId: string
  buyerName: string
  rating: number
  text: string
  images: string[]
}): Promise<{ ok: true; review: Review } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/reviews", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ review: Review }>(response)
  if (!result.ok) return result
  return { ok: true, review: result.data.review }
}

export async function replyToReview(id: string, sellerReply: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/reviews/${id}`, { method: "PATCH", headers, body: JSON.stringify({ sellerReply }) })
  const result = await parseResult<{ ok: true }>(response)
  if (!result.ok) return result
  return { ok: true }
}

export async function deleteReview(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/reviews/${id}`, { method: "DELETE", headers })
  const result = await parseResult<{ ok: true }>(response)
  if (!result.ok) return result
  return { ok: true }
}
