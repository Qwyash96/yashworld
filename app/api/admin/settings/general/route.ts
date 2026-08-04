import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getGeneralSettings, saveGeneralSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getGeneralSettings()
  return NextResponse.json(settings)
}

interface SaveBody {
  siteName?: string
  supportEmail?: string
  supportPhone?: string
  maintenanceMode?: boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  if (body.siteName !== undefined && !body.siteName.trim()) {
    return NextResponse.json({ error: "Site name cannot be empty." }, { status: 400 })
  }

  const patch = {
    ...(body.siteName !== undefined ? { siteName: body.siteName.trim() } : {}),
    ...(body.supportEmail !== undefined ? { supportEmail: body.supportEmail.trim() } : {}),
    ...(body.supportPhone !== undefined ? { supportPhone: body.supportPhone.trim() } : {}),
    ...(body.maintenanceMode !== undefined ? { maintenanceMode: body.maintenanceMode } : {}),
  }

  const saved = await saveGeneralSettings(patch)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.general_update",
    targetType: "settings",
    targetId: "general",
    after: patch,
  })

  return NextResponse.json(saved)
}
