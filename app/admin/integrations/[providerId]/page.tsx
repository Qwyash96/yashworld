"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plug, ShieldCheck, ScrollText, Webhook } from "lucide-react"
import Link from "next/link"
import {
  fetchIntegration,
  fetchIntegrationLogs,
  saveIntegration,
  testIntegration,
  verifyIntegration,
  type IntegrationLogEntryDto,
  type ProviderDetail,
  type WebhookEventDto,
} from "@/lib/admin-integrations-client"
import { ToggleSwitch } from "@/components/admin/toggle-switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminIntegrationDetailPage() {
  const params = useParams<{ providerId: string }>()
  const providerId = params.providerId

  const [detail, setDetail] = useState<ProviderDetail | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [environment, setEnvironment] = useState<"live" | "sandbox">("sandbox")
  const [priority, setPriority] = useState("0")
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [testing, setTesting] = useState(false)

  const [logs, setLogs] = useState<IntegrationLogEntryDto[] | null>(null)
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventDto[]>([])
  const [logLevel, setLogLevel] = useState<"" | "info" | "error">("")

  function refresh() {
    fetchIntegration(providerId).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDetail(result.data)
      setEnvironment(result.data.config.environment)
      setSettings(result.data.config.settings)
      setPriority(String(result.data.config.priority ?? 0))
    })
  }

  function loadLogs() {
    fetchIntegrationLogs(providerId, { level: logLevel || undefined }).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setLogs(result.entries)
      setWebhookEvents(result.webhookEvents)
    })
  }

  useEffect(refresh, [providerId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadLogs, [providerId, logLevel])

  // AdminLayout's route guard is the authoritative gate here (see
  // getPermissionForPath / components/admin/admin-sidebar.tsx) — payment
  // gateway paths (razorpay, cashfree, phonepe, payu, stripe, paypal) are
  // reachable by "payments"-holders, every other provider stays
  // super_admin-only. A redundant client-side super_admin-only check here
  // would incorrectly block finance from the very pages it's meant to use.
  if (!detail) return null
  const { config, adapter } = detail

  async function handleSave() {
    setSaving(true)
    const result = await saveIntegration(providerId, {
      environment,
      credentials,
      settings,
      priority: adapter.category === "payment" ? Number(priority) : undefined,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCredentials({})
    toast.success(
      result.verified
        ? `${adapter.name} connected and enabled — credentials verified successfully.`
        : `${adapter.name} settings saved.`,
    )
    refresh()
  }

  async function handleToggleEnabled(next: boolean) {
    const result = await saveIntegration(providerId, { enabled: next })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(next ? `${adapter.name} enabled.` : `${adapter.name} disabled.`)
    refresh()
  }

  async function handleSetDefault() {
    const result = await saveIntegration(providerId, { isDefault: true })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${adapter.name} set as default gateway.`)
    refresh()
  }

  async function handleVerify() {
    setVerifying(true)
    const result = await verifyIntegration(providerId)
    setVerifying(false)
    if (!result.ok) {
      toast.error(result.error)
      refresh()
      loadLogs()
      return
    }
    if (result.result.ok) toast.success(result.result.message)
    else toast.error(result.result.message)
    refresh()
    loadLogs()
  }

  async function handleTest() {
    setTesting(true)
    const result = await testIntegration(providerId)
    setTesting(false)
    if (!result.ok) {
      toast.error(result.error)
      loadLogs()
      return
    }
    if (result.result.ok) toast.success(result.result.message)
    else toast.error(result.result.message)
    loadLogs()
  }

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/integrations/${providerId}/webhook` : ""

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/integrations" className="flex items-center gap-1 text-xs text-[#444444] hover:text-green-700">
          <ArrowLeft className="size-3.5" />
          Integrations
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">{adapter.name}</h1>
            <p className="mt-1 text-sm text-[#444444]">{adapter.description}</p>
          </div>
          <ToggleSwitch checked={config.enabled} onChange={handleToggleEnabled} />
        </div>
      </div>

      {/* Status */}
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <Badge variant={config.connected ? "default" : "outline"}>{config.connected ? "Connected" : "Not Connected"}</Badge>
        <Badge variant={config.health === "healthy" ? "default" : config.health === "down" ? "destructive" : "outline"}>
          Health: {config.health}
        </Badge>
        {config.isDefault && <Badge variant="secondary">Default Gateway</Badge>}
        <span className="text-xs text-[#888888]">
          Last verified: {config.lastVerifiedAt ? new Date(config.lastVerifiedAt).toLocaleString() : "never"}
        </span>
        <span className="text-xs text-[#888888]">
          Last sync: {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "never"}
        </span>
      </section>

      {/* Credentials */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <ShieldCheck className="size-4 text-green-700" />
          Credentials
        </h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="environment">Environment</Label>
          <Select value={environment} onValueChange={(v) => v && setEnvironment(v as "live" | "sandbox")}>
            <SelectTrigger id="environment" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {adapter.credentialFields.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-600"> *</span>}
            </Label>
            <Input
              id={field.key}
              type={field.type === "password" ? "password" : "text"}
              value={credentials[field.key] ?? ""}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={
                config.credentialsSet[field.key]
                  ? "•••••••••••••••• (leave blank to keep)"
                  : field.placeholder ?? field.label
              }
              className="h-11"
            />
          </div>
        ))}

        {adapter.category === "payment" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="priority">Priority (lower runs first when multiple gateways are enabled)</Label>
            <Input
              id="priority"
              inputMode="numeric"
              value={priority}
              onChange={(e) => setPriority(e.target.value.replace(/[^0-9]/g, ""))}
              className="h-11 w-32"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button className="h-10" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" className="h-10" onClick={handleVerify} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Connection"}
          </Button>
          {adapter.supportsTest && (
            <Button variant="outline" className="h-10" onClick={handleTest} disabled={testing}>
              {testing ? "Testing..." : adapter.category === "payment" ? "Test Payment" : "Test API"}
            </Button>
          )}
          {adapter.category === "payment" && !config.isDefault && (
            <Button variant="outline" className="h-10" onClick={handleSetDefault}>
              Set as Default Gateway
            </Button>
          )}
        </div>
      </section>

      {/* Settings */}
      {adapter.settingFields.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <Plug className="size-4 text-green-700" />
            Settings
          </h2>
          {adapter.settingFields.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <span className="text-sm font-medium text-black">{field.label}</span>
                {field.helpText && <p className="text-xs text-[#888888]">{field.helpText}</p>}
              </div>
              {field.type === "boolean" ? (
                <ToggleSwitch
                  checked={Boolean(settings[field.key])}
                  onChange={(v) => setSettings((prev) => ({ ...prev, [field.key]: v }))}
                />
              ) : field.type === "select" ? (
                <Select
                  value={String(settings[field.key] ?? "")}
                  onValueChange={(v) => v && setSettings((prev) => ({ ...prev, [field.key]: v }))}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-9 w-32"
                  value={String(settings[field.key] ?? "")}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <Button className="mt-2 h-10 w-fit" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </section>
      )}

      {/* Webhook */}
      {adapter.supportsWebhook && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <Webhook className="size-4 text-green-700" />
            Webhook
          </h2>
          <div className="flex flex-col gap-2">
            <Label>Webhook URL</Label>
            <Input readOnly value={webhookUrl} className="h-11 bg-[#f3f5f2] font-mono text-xs" />
            <p className="text-xs text-[#444444]">Configure this URL against your {adapter.name} dashboard.</p>
          </div>
          {webhookEvents.length > 0 && (
            <div className="flex flex-col divide-y divide-border">
              {webhookEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 text-xs">
                  <Badge variant={event.verified ? "default" : "destructive"}>{event.verified ? "Verified" : "Failed"}</Badge>
                  <span className="text-[#888888]">{event.statusCode}</span>
                  <span className="text-[#888888]">{new Date(event.receivedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Logs */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
            <ScrollText className="size-4 text-green-700" />
            Logs
          </h2>
          <Select value={logLevel || "all"} onValueChange={(v) => setLogLevel(v === "all" ? "" : (v as "info" | "error"))}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="info">API logs</SelectItem>
              <SelectItem value="error">Error logs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-[#444444]">No log entries yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {logs.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={entry.level === "error" ? "destructive" : "outline"}>{entry.type}</Badge>
                  <span className="text-[#888888]">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[#444444]">{entry.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
