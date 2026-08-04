import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getSocialLinks, saveSocialLinks } from "@/lib/site-settings"
import { writeAuditLog } from "@/lib/audit-log"
import type { SocialLinks } from "@/types/site-settings"

const URL_PATTERN = /^https?:\/\/.+/i

function isValidUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim())
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const links = await getSocialLinks()
  return NextResponse.json(links)
}

interface SaveBody {
  instagram?: string
  whatsapp?: string
  youtube?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  const patch: Partial<SocialLinks> = {}

  for (const key of ["instagram", "whatsapp", "youtube"] as const) {
    const value = body[key]
    if (value === undefined) continue
    const trimmed = value.trim()
    if (trimmed && !isValidUrl(trimmed)) {
      return NextResponse.json({ error: `${key} must be a valid URL starting with http:// or https://.` }, { status: 400 })
    }
    patch[key] = trimmed
  }

  const saved = await saveSocialLinks(patch)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.social_update",
    targetType: "settings",
    targetId: "social",
    after: patch,
  })

  return NextResponse.json(saved)
}
