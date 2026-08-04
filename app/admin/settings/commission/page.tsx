"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Percent } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchPlatformSettings, savePlatformCommission } from "@/lib/admin-commission-client"
import { sanitizeDecimal } from "@/lib/numeric-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CommissionSettingsPage() {
  const admin = useAdminAuth()
  const [percent, setPercent] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPlatformSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPercent(String(result.settings.defaultCommissionPercent))
      setLoaded(true)
    })
  }, [])

  if (admin.role !== "super_admin") {
    return (
      <div className="p-8 text-center text-sm text-[#444444]">
        Only Super Admin can access Commission settings.
      </div>
    )
  }

  if (!loaded) return null

  async function handleSave() {
    const value = Number(percent)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Commission must be a percentage between 0 and 100.")
      return
    }
    setSaving(true)
    const result = await savePlatformCommission(value)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setPercent(String(result.settings.defaultCommissionPercent))
    toast.success("Commission rate saved.")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Commission</h1>
        <p className="mt-1 text-sm text-[#444444]">
          The single platform-wide commission rate, applied to every seller's item revenue when
          computing their payout. This is the only place it's set — no per-category or per-seller
          overrides.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Percent className="size-4 text-green-700" />
          Default Commission Rate
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="commission">Percent of item revenue</Label>
          <Input
            id="commission"
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(sanitizeDecimal(e.target.value))}
            className="h-11 w-40"
          />
        </div>

        <Button className="h-10 w-fit" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </section>
    </div>
  )
}
