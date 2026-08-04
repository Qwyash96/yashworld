import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getShippingSettings, saveShippingSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getShippingSettings()
  return NextResponse.json(settings)
}

interface SaveBody {
  standardRate?: number
  standardFreeThreshold?: number
  expressRate?: number
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  for (const key of ["standardRate", "standardFreeThreshold", "expressRate"] as const) {
    const value = body[key]
    if (value !== undefined && (typeof value !== "number" || value < 0)) {
      return NextResponse.json({ error: `${key} must be a non-negative number.` }, { status: 400 })
    }
  }

  const saved = await saveShippingSettings(body)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.shipping_update",
    targetType: "settings",
    targetId: "shipping",
    after: { ...body },
  })

  return NextResponse.json(saved)
}
