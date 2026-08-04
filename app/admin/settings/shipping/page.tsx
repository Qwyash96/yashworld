"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Truck, AlertTriangle } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchShippingSettings, saveShippingSettingsClient } from "@/lib/admin-platform-settings-client"
import { sanitizeDecimal } from "@/lib/numeric-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ShippingSettingsPage() {
  const admin = useAdminAuth()
  const [standardRate, setStandardRate] = useState("")
  const [standardFreeThreshold, setStandardFreeThreshold] = useState("")
  const [expressRate, setExpressRate] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchShippingSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStandardRate(String(result.settings.standardRate))
      setStandardFreeThreshold(String(result.settings.standardFreeThreshold))
      setExpressRate(String(result.settings.expressRate))
      setLoaded(true)
    })
  }, [])

  if (admin.role !== "super_admin") {
    return <div className="p-8 text-center text-sm text-[#444444]">Only Super Admin can access Shipping Settings.</div>
  }

  if (!loaded) return null

  async function handleSave() {
    setSaving(true)
    const result = await saveShippingSettingsClient({
      standardRate: Number(standardRate),
      standardFreeThreshold: Number(standardFreeThreshold),
      expressRate: Number(expressRate),
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Shipping settings saved.")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Shipping</h1>
        <p className="mt-1 text-sm text-[#444444]">Standard and express shipping rates.</p>
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Saved here for record-keeping, but the live checkout engine still charges the rates hardcoded in{" "}
          <code className="font-mono">lib/shipping.ts</code>. Wiring this in was intentionally deferred — the
          checkout total is verified against a second independent calculation at payment time, and having the
          rate change between those two calls would risk a real payment-amount mismatch.
        </span>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Truck className="size-4 text-green-700" />
          Rates
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="standard-rate">Standard Shipping Rate</Label>
          <Input
            id="standard-rate"
            inputMode="decimal"
            value={standardRate}
            onChange={(e) => setStandardRate(sanitizeDecimal(e.target.value))}
            className="h-11 w-40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="standard-free-threshold">Free Standard Shipping Above</Label>
          <Input
            id="standard-free-threshold"
            inputMode="decimal"
            value={standardFreeThreshold}
            onChange={(e) => setStandardFreeThreshold(sanitizeDecimal(e.target.value))}
            className="h-11 w-40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="express-rate">Express Shipping Rate</Label>
          <Input
            id="express-rate"
            inputMode="decimal"
            value={expressRate}
            onChange={(e) => setExpressRate(sanitizeDecimal(e.target.value))}
            className="h-11 w-40"
          />
        </div>

        <Button className="mt-2 h-10 w-fit" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </section>
    </div>
  )
}
