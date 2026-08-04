"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Share2 } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { fetchSocialLinks, saveSocialLinks } from "@/lib/admin-social-settings-client"
import type { SocialLinks } from "@/types/site-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SocialSettingsPage() {
  const admin = useAdminAuth()
  const [links, setLinks] = useState<SocialLinks | null>(null)
  const [saving, setSaving] = useState(false)

  function refresh() {
    fetchSocialLinks().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setLinks(result.links)
    })
  }

  useEffect(refresh, [])

  if (admin.role !== "super_admin") {
    return (
      <div className="p-8 text-center text-sm text-[#444444]">
        Only Super Admin can access Social Links settings.
      </div>
    )
  }

  if (!links) return null

  async function handleSave() {
    setSaving(true)
    const result = await saveSocialLinks(links!)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setLinks(result.links)
    toast.success("Social links saved.")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Social Links</h1>
        <p className="mt-1 text-sm text-[#444444]">
          Configure the Instagram, WhatsApp and YouTube links shown in the site footer. Leave a field blank to hide
          that icon.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <Share2 className="size-4 text-green-700" />
          Social Media URLs
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="instagram">Instagram URL</Label>
          <Input
            id="instagram"
            value={links.instagram ?? ""}
            onChange={(e) => setLinks((prev) => ({ ...prev, instagram: e.target.value }))}
            placeholder="https://instagram.com/yourhandle"
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp URL</Label>
          <Input
            id="whatsapp"
            value={links.whatsapp ?? ""}
            onChange={(e) => setLinks((prev) => ({ ...prev, whatsapp: e.target.value }))}
            placeholder="https://wa.me/91XXXXXXXXXX"
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="youtube">YouTube URL</Label>
          <Input
            id="youtube"
            value={links.youtube ?? ""}
            onChange={(e) => setLinks((prev) => ({ ...prev, youtube: e.target.value }))}
            placeholder="https://youtube.com/@yourchannel"
            className="h-11"
          />
        </div>

        <Button className="h-10 w-fit" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </section>
    </div>
  )
}
