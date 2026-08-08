import { auth } from "@/services/firebase/client"
import type { FinanceAdjustment, AdjustmentParty, AdjustmentType, AdjustmentStatus, FinanceAdjustmentInput } from "@/types/finance"
import type { FinanceDocument, FinanceDocumentType } from "@/types/finance-document"

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

export interface ListAdjustmentsParams {
  orderId?: string
  partyType?: AdjustmentParty
  partyId?: string
  type?: AdjustmentType
  status?: AdjustmentStatus
}

export async function fetchAdjustments(params: ListAdjustmentsParams = {}): Promise<{ ok: true; adjustments: FinanceAdjustment[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v && query.set(k, v))
  const response = await fetch(`/api/admin/finance/adjustments?${query.toString()}`, { headers })
  const result = await parseResult<{ adjustments: FinanceAdjustment[] }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function fetchAdjustmentDetail(
  id: string,
): Promise<{ ok: true; adjustment: FinanceAdjustment; document: FinanceDocument | null } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/finance/adjustments/${id}`, { headers })
  const result = await parseResult<{ adjustment: FinanceAdjustment; document: FinanceDocument | null }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function createAdjustment(input: FinanceAdjustmentInput): Promise<{ ok: true; adjustment: FinanceAdjustment } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/finance/adjustments", { method: "POST", headers, body: JSON.stringify(input) })
  const result = await parseResult<{ ok: true; adjustment: FinanceAdjustment }>(response)
  if (!result.ok) return result
  return { ok: true, adjustment: result.data.adjustment }
}

export async function decideAdjustment(
  id: string,
  decision: "Approved" | "Rejected",
): Promise<{ ok: true; adjustment: FinanceAdjustment; documentId?: string } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/finance/adjustments/${id}/decision`, { method: "POST", headers, body: JSON.stringify({ decision }) })
  const result = await parseResult<{ adjustment: FinanceAdjustment; documentId?: string }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export interface FinanceDashboardData {
  totalSales: number
  totalRefunds: number
  pendingRefunds: number
  completedRefunds: number
  sellerPayables: number
  platformEarnings: number
  charges: number
  credits: number
  adjustments: number
}

export interface FinanceDashboardFilters {
  from?: string
  to?: string
  sellerId?: string
  buyerId?: string
  paymentMethod?: string
}

export async function fetchFinanceDashboard(filters: FinanceDashboardFilters = {}): Promise<{ ok: true; data: FinanceDashboardData } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && query.set(k, v))
  const response = await fetch(`/api/admin/finance/dashboard?${query.toString()}`, { headers })
  return parseResult<FinanceDashboardData>(response)
}

export interface LedgerEntry {
  label: string
  amount: number
  at: string
  documentId?: string
  documentNumber?: string
}

export async function fetchLedger(orderId: string): Promise<{ ok: true; entries: LedgerEntry[]; netTotal: number } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/finance/ledger/${orderId}`, { headers })
  const result = await parseResult<{ entries: LedgerEntry[]; netTotal: number }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function fetchFinanceDocuments(
  filter: { orderId?: string; type?: FinanceDocumentType; partyType?: "buyer" | "seller"; partyId?: string } = {},
): Promise<{ ok: true; documents: FinanceDocument[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const query = new URLSearchParams()
  Object.entries(filter).forEach(([k, v]) => v && query.set(k, v))
  const response = await fetch(`/api/finance/documents?${query.toString()}`, { headers })
  const result = await parseResult<{ documents: FinanceDocument[] }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

export async function fetchFinanceDocumentDetail<T = unknown>(id: string): Promise<{ ok: true; document: FinanceDocument; context: T } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/finance/documents/${id}`, { headers })
  const result = await parseResult<{ document: FinanceDocument; context: T }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}

/** Mints a new Invoice/Payment Receipt document record for the caller's own
 * order — see app/api/finance/documents/generate/route.ts. */
export async function generateFinanceDocument(
  type: "invoice" | "payment_receipt",
  orderId: string,
): Promise<{ ok: true; document: FinanceDocument } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/finance/documents/generate", { method: "POST", headers, body: JSON.stringify({ type, orderId }) })
  const result = await parseResult<{ document: FinanceDocument }>(response)
  if (!result.ok) return result
  return { ok: true, document: result.data.document }
}
