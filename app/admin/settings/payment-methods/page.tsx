"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Wallet } from "lucide-react"
import { fetchPaymentMethodsSettings, savePaymentMethodsSettingsClient } from "@/lib/admin-platform-settings-client"
import type { PaymentMethodsSettings } from "@/types/platform-settings"
import { ToggleSwitch } from "@/components/admin/toggle-switch"
import { Button } from "@/components/ui/button"

const METHOD_LABELS: { key: keyof PaymentMethodsSettings["methods"]; label: string; description: string }[] = [
  { key: "upi", label: "UPI", description: "Google Pay, PhonePe, Paytm and other UPI apps." },
  { key: "cards", label: "Cards", description: "Credit and debit cards." },
  { key: "netbanking", label: "Net Banking", description: "Direct bank transfer via net banking." },
  { key: "wallet", label: "Wallet", description: "Paytm Wallet, Amazon Pay and similar." },
  { key: "emi", label: "EMI", description: "Card and cardless EMI options." },
  { key: "cod", label: "Cash on Delivery", description: "Pay in cash when the order arrives." },
]

export default function PaymentMethodsSettingsPage() {
  const [methods, setMethods] = useState<PaymentMethodsSettings["methods"] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPaymentMethodsSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setMethods(result.settings.methods)
    })
  }, [])

  if (!methods) return null

  async function handleToggle(key: keyof PaymentMethodsSettings["methods"], checked: boolean) {
    const previous = methods!
    setMethods({ ...previous, [key]: checked })
    setSaving(true)
    const result = await savePaymentMethodsSettingsClient({ [key]: checked })
    setSaving(false)
    if (!result.ok) {
      setMethods(previous)
      toast.error(result.error)
      return
    }
    setMethods(result.settings.methods)
    toast.success("Payment methods saved.")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Payment Settings</h1>
        <p className="mt-1 text-sm text-[#444444]">
          Which checkout methods buyers can choose from — independent of which payment gateway actually processes
          them. Gateway credentials live in{" "}
          <Link href="/admin/integrations?category=payment" className="underline">
            Payment Gateways
          </Link>
          .
        </p>
      </div>

      <section className="flex flex-col gap-1 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Wallet className="size-4 text-green-700" />
          Checkout Methods
        </div>

        {METHOD_LABELS.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
            <div>
              <p className="text-sm font-medium text-black">{label}</p>
              <p className="text-xs text-[#666666]">{description}</p>
            </div>
            <ToggleSwitch checked={methods[key]} disabled={saving} onChange={(checked) => handleToggle(key, checked)} />
          </div>
        ))}
      </section>

      <Button variant="outline" className="h-10 w-fit" render={<Link href="/admin/integrations?category=payment" />}>
        Manage Payment Gateways
      </Button>
    </div>
  )
}
