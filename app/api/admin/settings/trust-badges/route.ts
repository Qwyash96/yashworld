import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getTrustBadgesSettings, saveTrustBadgesSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"
import type { TrustBadge } from "@/types/platform-settings"

const VALID_ICONS: TrustBadge["icon"][] = ["shield", "truck", "rotate-ccw", "badge-check", "headset", "leaf"]

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getTrustBadgesSettings()
  return NextResponse.json(settings)
}

interface SaveBody {
  badges?: TrustBadge[]
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  if (!Array.isArray(body.badges)) {
    return NextResponse.json({ error: "badges must be an array." }, { status: 400 })
  }
  for (const badge of body.badges) {
    if (!badge.title?.trim() || !badge.description?.trim() || !VALID_ICONS.includes(badge.icon)) {
      return NextResponse.json({ error: "Each badge needs a title, description, and a valid icon." }, { status: 400 })
    }
  }

  const saved = await saveTrustBadgesSettings({ badges: body.badges })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.trust_badges_update",
    targetType: "settings",
    targetId: "trustBadges",
    after: { count: body.badges.length },
  })

  return NextResponse.json(saved)
}
