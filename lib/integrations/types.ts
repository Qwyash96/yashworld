import "server-only"
import type { IntegrationCategory, IntegrationEnvironment, IntegrationHealth } from "@/types/integrations"

export interface CredentialFieldDef {
  key: string
  label: string
  type: "text" | "password" | "url"
  required: boolean
  placeholder?: string
}

export interface SettingFieldDef {
  key: string
  label: string
  type: "boolean" | "select" | "number" | "text"
  options?: { value: string; label: string }[]
  default: unknown
  helpText?: string
}

export interface VerifyResult {
  ok: boolean
  message: string
  health: IntegrationHealth
}

export interface TestResult {
  ok: boolean
  message: string
  detail?: Record<string, unknown>
}

export interface WebhookResult {
  ok: boolean
  status: number
  message: string
}

/**
 * The one contract every provider implements. The generic admin UI and the
 * generic API routes (app/api/admin/integrations/**) are driven entirely by
 * what an adapter declares here — its field list, whether it supports a
 * webhook/test action — so adding a new provider means writing one new file
 * implementing this interface and registering it in
 * lib/integrations/registry.ts. Nothing else in the framework changes.
 */
export interface IntegrationAdapter {
  id: string
  name: string
  category: IntegrationCategory
  description: string
  credentialFields: CredentialFieldDef[]
  settingFields: SettingFieldDef[]
  supportsWebhook: boolean
  supportsTest: boolean
  /** Decrypted credentials, never logged or persisted by the caller — call the real provider API and report the outcome. */
  verifyConnection(credentials: Record<string, string>, environment: IntegrationEnvironment): Promise<VerifyResult>
  /** A lightweight authenticated call ("Test API"/"Test Payment" button) — not a full live checkout round-trip. */
  testAction?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    settings: Record<string, unknown>,
  ): Promise<TestResult>
  /** The adapter is responsible for verifying the provider's own webhook signature using the supplied credentials. */
  handleWebhook?(rawBody: string, headers: Record<string, string>, credentials: Record<string, string>): Promise<WebhookResult>
}
