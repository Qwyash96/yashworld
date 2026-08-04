"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Settings, ShieldCheck, Plus, Trash2 } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import {
  fetchGeneralSettings,
  saveGeneralSettingsClient,
  fetchTrustBadgesSettings,
  saveTrustBadgesSettingsClient,
} from "@/lib/admin-platform-settings-client"
import type { TrustBadge } from "@/types/platform-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ICON_OPTIONS: TrustBadge["icon"][] = ["shield", "badge-check", "rotate-ccw", "truck", "headset", "leaf"]

export default function GeneralSettingsPage() {
  const admin = useAdminAuth()
  const [siteName, setSiteName] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [supportPhone, setSupportPhone] = useState("")
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const [badges, setBadges] = useState<TrustBadge[]>([])
  const [badgesLoaded, setBadgesLoaded] = useState(false)
  const [savingBadges, setSavingBadges] = useState(false)

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
    fetchTrustBadgesSettings().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setBadges(result.settings.badges)
      setBadgesLoaded(true)
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

  function updateBadge(index: number, patch: Partial<TrustBadge>) {
    setBadges((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  function addBadge() {
    setBadges((prev) => [...prev, { icon: "shield", title: "", description: "" }])
  }

  function removeBadge(index: number) {
    setBadges((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSaveBadges() {
    if (badges.some((b) => !b.title.trim() || !b.description.trim())) {
      toast.error("Every trust badge needs a title and description.")
      return
    }
    setSavingBadges(true)
    const result = await saveTrustBadgesSettingsClient(badges)
    setSavingBadges(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setBadges(result.settings.badges)
    toast.success("Trust badges saved.")
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

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <ShieldCheck className="size-4 text-green-700" />
          Trust Badges
        </div>
        <p className="text-xs text-[#444444]">Shown as a strip on the homepage — e.g. &quot;Secure Payments&quot;, &quot;Verified Sellers&quot;.</p>

        {!badgesLoaded ? null : (
          <>
            <div className="flex flex-col gap-4">
              {badges.map((badge, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-end">
                  <div className="flex flex-col gap-2 sm:w-36">
                    <Label className="text-xs">Icon</Label>
                    <Select value={badge.icon} onValueChange={(v) => v && updateBadge(i, { icon: v as TrustBadge["icon"] })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((icon) => (
                          <SelectItem key={icon} value={icon}>
                            {icon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label className="text-xs">Title</Label>
                    <Input className="h-10" value={badge.title} onChange={(e) => updateBadge(i, { title: e.target.value })} />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label className="text-xs">Description</Label>
                    <Input className="h-10" value={badge.description} onChange={(e) => updateBadge(i, { description: e.target.value })} />
                  </div>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => removeBadge(i)} aria-label="Remove badge">
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="h-10" onClick={addBadge}>
                <Plus className="size-4" />
                Add Badge
              </Button>
              <Button className="h-10" onClick={handleSaveBadges} disabled={savingBadges}>
                {savingBadges ? "Saving..." : "Save Badges"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
