import { auth } from "@/services/firebase/client"
import type { CredentialFieldDef, SettingFieldDef, TestResult, VerifyResult } from "@/lib/integrations/types"
import type { IntegrationCategory, MaskedIntegrationConfig } from "@/types/integrations"

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

export interface ProviderSummary {
  config: MaskedIntegrationConfig
  adapter: {
    id: string
    name: string
    category: IntegrationCategory
    description: string
    supportsWebhook: boolean
    supportsTest: boolean
  }
}

export async function fetchIntegrations(): Promise<{ ok: true; providers: ProviderSummary[] } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch("/api/admin/integrations", { headers })
  const result = await parseResult<{ providers: ProviderSummary[] }>(response)
  if (!result.ok) return result
  return { ok: true, providers: result.data.providers }
}

export interface ProviderDetail {
  config: MaskedIntegrationConfig
  adapter: {
    id: string
    name: string
    category: IntegrationCategory
    description: string
    credentialFields: CredentialFieldDef[]
    settingFields: SettingFieldDef[]
    supportsWebhook: boolean
    supportsTest: boolean
  }
}

export async function fetchIntegration(providerId: string): Promise<{ ok: true; data: ProviderDetail } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/integrations/${providerId}`, { headers })
  return parseResult<ProviderDetail>(response)
}

export interface SaveIntegrationInput {
  enabled?: boolean
  environment?: "live" | "sandbox"
  credentials?: Record<string, string>
  settings?: Record<string, unknown>
  isDefault?: boolean
  priority?: number
}

export async function saveIntegration(
  providerId: string,
  patch: SaveIntegrationInput,
): Promise<{ ok: true; config: MaskedIntegrationConfig; verified: boolean | null } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/integrations/${providerId}`, { method: "POST", headers, body: JSON.stringify(patch) })
  const result = await parseResult<{ config: MaskedIntegrationConfig; verified: boolean | null }>(response)
  if (!result.ok) return result
  return { ok: true, config: result.data.config, verified: result.data.verified }
}

export async function verifyIntegration(providerId: string): Promise<{ ok: true; result: VerifyResult } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/integrations/${providerId}/verify`, { method: "POST", headers })
  const result = await parseResult<VerifyResult>(response)
  if (!result.ok) return result
  return { ok: true, result: result.data }
}

export async function testIntegration(providerId: string): Promise<{ ok: true; result: TestResult } | { ok: false; error: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/integrations/${providerId}/test`, { method: "POST", headers })
  const result = await parseResult<TestResult>(response)
  if (!result.ok) return result
  return { ok: true, result: result.data }
}

export interface IntegrationLogEntryDto {
  id: string
  level: "info" | "error"
  type: string
  message: string
  createdAt: string
}

export interface WebhookEventDto {
  id: string
  verified: boolean
  statusCode: number
  receivedAt: string
}

export async function fetchIntegrationLogs(
  providerId: string,
  opts: { level?: "info" | "error"; cursor?: string | null },
): Promise<
  | { ok: true; entries: IntegrationLogEntryDto[]; nextCursor: string | null; hasMore: boolean; webhookEvents: WebhookEventDto[] }
  | { ok: false; error: string }
> {
  const headers = await authHeaders()
  const params = new URLSearchParams()
  if (opts.level) params.set("level", opts.level)
  if (opts.cursor) params.set("cursor", opts.cursor)
  const response = await fetch(`/api/admin/integrations/${providerId}/logs?${params.toString()}`, { headers })
  const result = await parseResult<{
    entries: IntegrationLogEntryDto[]
    nextCursor: string | null
    hasMore: boolean
    webhookEvents: WebhookEventDto[]
  }>(response)
  if (!result.ok) return result
  return { ok: true, ...result.data }
}
