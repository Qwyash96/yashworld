"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ImageIcon } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { auth } from "@/services/firebase/client"
import { uploadSiteBrandLogo } from "@/services/storage.service"
import { SingleImageUploader } from "@/components/media/single-image-uploader"
import type { SiteBranding } from "@/types/site-settings"
import { Button } from "@/components/ui/button"

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

export default function BrandingSettingsPage() {
  const admin = useAdminAuth()
  const [branding, setBranding] = useState<SiteBranding | null>(null)
  const [saving, setSaving] = useState(false)

  function refresh() {
    authHeaders()
      .then((headers) => fetch("/api/admin/settings/branding", { headers }))
      .then((r) => r.json())
      .then(setBranding)
      .catch(() => toast.error("Failed to load branding settings."))
  }

  useEffect(refresh, [])

  if (admin.role !== "super_admin") {
    return <div className="p-8 text-center text-sm text-[#444444]">Only Super Admin can access Branding settings.</div>
  }

  if (!branding) return null

  async function handleSave(logoUrl: string) {
    setBranding((b) => ({ ...b, logoUrl }))
    setSaving(true)
    try {
      const headers = await authHeaders()
      const response = await fetch("/api/admin/settings/branding", {
        method: "POST",
        headers,
        body: JSON.stringify({ logoUrl }),
      })
      if (!response.ok) throw new Error((await response.json()).error ?? "Save failed.")
      toast.success("Branding saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Branding</h1>
        <p className="mt-1 text-sm text-[#444444]">
          Upload a custom logo for the site header and footer. Leave empty to use the default YashWorld logo.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <ImageIcon className="size-4 text-green-700" />
          Site Logo
        </div>

        <SingleImageUploader
          uid={admin.uid}
          folder="site-branding"
          value={branding.logoUrl ?? ""}
          onChange={handleSave}
          uploadFn={uploadSiteBrandLogo}
          aspectClassName="aspect-[2/1] max-w-64"
        />

        {saving && <p className="text-xs text-[#444444]">Saving...</p>}

        {branding.logoUrl && (
          <Button variant="outline" className="h-10 w-fit" onClick={() => handleSave("")}>
            Remove Logo
          </Button>
        )}
      </section>
    </div>
  )
}
