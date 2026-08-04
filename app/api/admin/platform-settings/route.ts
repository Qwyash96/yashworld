import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getPlatformSettings()
  return NextResponse.json(settings)
}

interface SaveBody {
  defaultCommissionPercent?: number
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  if (
    typeof body.defaultCommissionPercent !== "number" ||
    body.defaultCommissionPercent < 0 ||
    body.defaultCommissionPercent > 100
  ) {
    return NextResponse.json({ error: "Commission must be a percentage between 0 and 100." }, { status: 400 })
  }

  const saved = await savePlatformSettings({ defaultCommissionPercent: body.defaultCommissionPercent })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.commission_update",
    targetType: "settings",
    targetId: "commission",
    after: { defaultCommissionPercent: body.defaultCommissionPercent },
  })

  return NextResponse.json(saved)
}
