import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getPaymentSettings, savePaymentSettings } from "@/lib/payment-settings"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { writeAuditLog } from "@/lib/audit-log"

/** Tests the currently-saved Razorpay credentials with a cheap authenticated
 * call, and records the result — this is what drives the Connected / Not
 * Connected badge on the settings page. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getPaymentSettings()
  if (!settings.keyId || !settings.keySecret) {
    return NextResponse.json({ error: "Save a Key ID and Key Secret before verifying." }, { status: 400 })
  }

  try {
    await getRazorpayClient(settings.keyId, settings.keySecret).orders.all({ count: 1 })
    await savePaymentSettings({ connected: true, lastVerifiedAt: new Date().toISOString() })
    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "settings.payment_verify",
      targetType: "settings",
      targetId: "payments",
      after: { connected: true },
    })
    return NextResponse.json({ connected: true })
  } catch (error) {
    await savePaymentSettings({ connected: false })
    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "settings.payment_verify",
      targetType: "settings",
      targetId: "payments",
      after: { connected: false },
    })
    const message = (error as { error?: { description?: string } })?.error?.description
    return NextResponse.json(
      { connected: false, error: message ?? "Couldn't connect to Razorpay with these credentials." },
      { status: 400 },
    )
  }
}
