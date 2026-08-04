import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdPricingSettings, saveAdPricingSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const pricing = await getAdPricingSettings()
  return NextResponse.json(pricing)
}

interface SaveBody {
  feeByDurationDays?: Partial<Record<"1" | "3" | "7" | "15" | "30", number>>
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  if (!body.feeByDurationDays) {
    return NextResponse.json({ error: "Missing pricing." }, { status: 400 })
  }
  for (const [key, value] of Object.entries(body.feeByDurationDays)) {
    if (typeof value !== "number" || value < 0) {
      return NextResponse.json({ error: `Invalid fee for ${key} day(s).` }, { status: 400 })
    }
  }

  const current = await getAdPricingSettings()
  const saved = await saveAdPricingSettings({
    feeByDurationDays: { ...current.feeByDurationDays, ...body.feeByDurationDays },
  })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.ad_pricing_update",
    targetType: "settings",
    targetId: "adPricing",
    after: saved.feeByDurationDays,
  })

  return NextResponse.json(saved)
}
