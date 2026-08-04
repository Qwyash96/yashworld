"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CreditCard, Link2, Wallet, Settings2, Banknote, ShieldCheck, AlertTriangle } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import {
  fetchPaymentSettings,
  savePaymentSettings,
  verifyRazorpayConnection,
} from "@/lib/admin-payment-settings-client"
import type { MaskedPaymentSettings } from "@/types/payment-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const METHOD_LABELS: { key: keyof MaskedPaymentSettings["methods"]; label: string }[] = [
  { key: "upi", label: "UPI" },
  { key: "cards", label: "Cards" },
  { key: "netbanking", label: "Net Banking" },
  { key: "wallet", label: "Wallet" },
  { key: "emi", label: "EMI" },
  { key: "cod", label: "Cash on Delivery" },
]

export default function PaymentSettingsPage() {
  const admin = useAdminAuth()
  const [settings, setSettings] = useState<MaskedPaymentSettings | null>(null)
  const [keyId, setKeyId] = useState("")
  const [keySecret, setKeySecret] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [paymentLink, setPaymentLink] = useState("")
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [savingLink, setSavingLink] = useState(false)

  function refresh() {
    fetchPaymentSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSettings(result.settings)
      setKeyId(result.settings.keyId)
      setPaymentLink(result.settings.paymentLink ?? "")
    })
  }

  useEffect(refresh, [])

  // DEV_SHOW_ADMIN_MENU_TO_ALL (lib/dev-flags.ts): temporary, frontend-only —
  // remove this bypass to restore the super_admin-only page gate. The
  // underlying API (/api/admin/payment-settings) still requires super_admin
  // server-side regardless, so a non-super-admin can view this form but any
  // Save/Verify call will still fail with a 403.
  if (!DEV_SHOW_ADMIN_MENU_TO_ALL && admin.role !== "super_admin") {
    return (
      <div className="p-8 text-center text-sm text-[#444444]">
        Only Super Admin can access Payment Settings.
      </div>
    )
  }

  if (!settings) return null

  async function updateMethod(key: keyof MaskedPaymentSettings["methods"], value: boolean) {
    const result = await savePaymentSettings({ methods: { [key]: value } })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSettings(result.settings)
  }

  async function updateCheckout(patch: Partial<MaskedPaymentSettings["checkout"]>) {
    const result = await savePaymentSettings({ checkout: patch })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSettings(result.settings)
  }

  async function handleSaveRazorpay() {
    if (!settings) return
    setSaving(true)
    const result = await savePaymentSettings({
      keyId,
      ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
      ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSettings(result.settings)
    setKeySecret("")
    setWebhookSecret("")
    toast.success("Razorpay settings saved.")
  }

  async function handleVerify() {
    setVerifying(true)
    const result = await verifyRazorpayConnection()
    setVerifying(false)
    if (!result.ok) {
      toast.error(result.error)
      refresh()
      return
    }
    toast.success("Connected to Razorpay successfully.")
    refresh()
  }

  async function handleSavePaymentLink() {
    setSavingLink(true)
    const result = await savePaymentSettings({ paymentLink })
    setSavingLink(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSettings(result.settings)
    toast.success("Payment Link saved.")
  }

  const keysConfigured = !!settings.keyId

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Payments</h1>
        <p className="mt-1 text-sm text-[#444444]">
          Configure Razorpay and control which payment methods buyers see at checkout.
        </p>
      </div>

      {/* Razorpay Settings */}
      <section id="razorpay-settings" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <CreditCard className="size-4 text-green-700" />
          Razorpay Settings
        </h2>

        {!keysConfigured && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            <AlertTriangle className="size-4 shrink-0" />
            Razorpay API Keys are not configured yet.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="keyId">Razorpay Key ID</Label>
            <Input id="keyId" value={keyId} onChange={(e) => setKeyId(e.target.value)} className="h-11" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="keySecret">Razorpay Key Secret</Label>
            <Input
              id="keySecret"
              type="password"
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder={settings.keySecretSet ? "•••••••••••••••• (leave blank to keep)" : "Enter your Key Secret"}
              className="h-11"
            />
          </div>

          <p className="text-xs text-[#444444]">
            Save tests the Key ID/Secret against Razorpay before storing them — an invalid pair is rejected and
            nothing is written. Use Verify Connection any time afterward to re-check without changing keys.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button className="h-10" onClick={handleSaveRazorpay} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" className="h-10" onClick={handleVerify} disabled={verifying}>
              {verifying ? "Verifying..." : "Verify Connection"}
            </Button>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section id="payment-methods" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Wallet className="size-4 text-green-700" />
          Payment Methods
        </h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {METHOD_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-black">{label}</span>
              <ToggleSwitch checked={settings.methods[key]} onChange={(v) => updateMethod(key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Checkout Settings */}
      <section id="checkout-settings" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Settings2 className="size-4 text-green-700" />
          Checkout Settings
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-black">Enable Razorpay Checkout</span>
            <ToggleSwitch
              checked={settings.checkout.razorpayEnabled}
              onChange={(v) => updateCheckout({ razorpayEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-black">Enable COD Checkout</span>
            <ToggleSwitch checked={settings.checkout.codEnabled} onChange={(v) => updateCheckout({ codEnabled: v })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultMethod">Default Payment Method</Label>
            <Select
              value={settings.checkout.defaultMethod}
              onValueChange={(v) => v && updateCheckout({ defaultMethod: v as "razorpay" | "cod" })}
            >
              <SelectTrigger id="defaultMethod" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cod">Cash on Delivery</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Payment Link (optional fallback) */}
      <section id="payment-link" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Link2 className="size-4 text-green-700" />
          Payment Link (Optional Fallback)
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="paymentLink">Razorpay Payment Link (Optional)</Label>
          <Input
            id="paymentLink"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://rzp.io/l/your-payment-link"
            className="h-11"
          />
          <p className="text-xs text-[#444444]">
            If filled, buyers are redirected here instead of being blocked whenever no payment method (Razorpay or
            COD) is actually available at checkout.
          </p>
          <Button className="mt-2 h-10 w-fit" onClick={handleSavePaymentLink} disabled={savingLink}>
            {savingLink ? "Saving..." : "Save"}
          </Button>
        </div>
      </section>

      {/* Currency */}
      <section id="currency" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Banknote className="size-4 text-green-700" />
          Currency
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="currency">Checkout Currency</Label>
          <Input id="currency" value={settings.checkout.currency} disabled className="h-11 w-40 bg-[#f3f5f2]" />
        </div>
      </section>

      {/* Webhook Settings */}
      <section id="webhook-settings" className="scroll-mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <ShieldCheck className="size-4 text-green-700" />
          Webhook Settings
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhookSecret">Razorpay Webhook Secret</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={
                settings.webhookSecretSet ? "•••••••••••••••• (leave blank to keep)" : "Enter your webhook secret"
              }
              className="h-11"
            />
            <p className="text-xs text-[#444444]">
              Set this to the same secret configured against the webhook URL in your Razorpay Dashboard. Saved with
              the Razorpay Settings section&apos;s Save button above.
            </p>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-[#444444]">
            <li>Every payment is verified server-side via HMAC signature before an order is created.</li>
            <li>Key Secret and Webhook Secret are never sent to any browser — only this masked view.</li>
            <li>All reads/writes of this configuration go through Admin-SDK-only server routes.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-green-600" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}
