"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Settings } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchGeneralSettings, saveGeneralSettingsClient } from "@/lib/admin-platform-settings-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function GeneralSettingsPage() {
  const admin = useAdminAuth()
  const [siteName, setSiteName] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [supportPhone, setSupportPhone] = useState("")
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGeneralSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSiteName(result.settings.siteName)
      setSupportEmail(result.settings.supportEmail)
      setSupportPhone(result.settings.supportPhone)
      setMaintenanceMode(result.settings.maintenanceMode)
      setLoaded(true)
    })
  }, [])

  if (admin.role !== "super_admin") {
    return <div className="p-8 text-center text-sm text-[#444444]">Only Super Admin can access General Settings.</div>
  }

  if (!loaded) return null

  async function handleSave() {
    setSaving(true)
    const result = await saveGeneralSettingsClient({ siteName, supportEmail, supportPhone, maintenanceMode })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("General settings saved.")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">General Settings</h1>
        <p className="mt-1 text-sm text-[#444444]">Site identity and support contact info shown across the platform.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Settings className="size-4 text-green-700" />
          Site
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="site-name">Site Name</Label>
          <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="h-11" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="support-email">Support Email</Label>
          <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="h-11" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="support-phone">Support Phone</Label>
          <Input id="support-phone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className="h-11" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} />
          Maintenance mode (informational flag — not yet enforced by a storefront banner or gate)
        </label>

        <Button className="mt-2 h-10 w-fit" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </section>
    </div>
  )
}
