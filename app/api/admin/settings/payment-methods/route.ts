import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getPaymentMethodsSettings, savePaymentMethodsSettings } from "@/lib/platform-settings"
import { writeAuditLog } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getPaymentMethodsSettings()
  return NextResponse.json(settings)
}

interface SaveBody {
  upi?: boolean
  cards?: boolean
  netbanking?: boolean
  wallet?: boolean
  emi?: boolean
  cod?: boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "payments")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody
  for (const key of ["upi", "cards", "netbanking", "wallet", "emi", "cod"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `${key} must be a boolean.` }, { status: 400 })
    }
  }

  const saved = await savePaymentMethodsSettings(body)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.payment_methods_update",
    targetType: "settings",
    targetId: "paymentMethods",
    after: { ...body },
  })

  return NextResponse.json(saved)
}
