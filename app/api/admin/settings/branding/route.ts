import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getSiteBranding, saveSiteBranding } from "@/lib/site-settings"
import { writeAuditLog } from "@/lib/audit-log"
import type { SiteBranding } from "@/types/site-settings"

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const branding = await getSiteBranding()
  return NextResponse.json(branding)
}

interface SaveBody {
  logoUrl?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  const patch: Partial<SiteBranding> = {}
  if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl.trim()

  const saved = await saveSiteBranding(patch)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.branding_update",
    targetType: "settings",
    targetId: "branding",
    after: patch,
  })

  return NextResponse.json(saved)
}
