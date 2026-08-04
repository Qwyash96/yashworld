import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getPaymentSettings, savePaymentSettings } from "@/lib/payment-settings"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { MaskedPaymentSettings, PaymentSettings } from "@/types/payment-settings"

function mask(settings: PaymentSettings): MaskedPaymentSettings {
  const { keySecret, webhookSecret, ...rest } = settings
  return { ...rest, keySecretSet: !!keySecret, webhookSecretSet: !!webhookSecret }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const settings = await getPaymentSettings()
  return NextResponse.json(mask(settings))
}

interface SaveBody {
  keyId?: string
  keySecret?: string
  webhookSecret?: string
  paymentLink?: string
  methods?: Partial<PaymentSettings["methods"]>
  checkout?: Partial<Omit<PaymentSettings["checkout"], "currency">>
}

// Razorpay key IDs are always "rzp_test_..." or "rzp_live_..." — a cheap,
// fast rejection of obviously-wrong input before ever calling Razorpay's API.
const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{8,}$/
const URL_PATTERN = /^https?:\/\/.+/i

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as SaveBody

  if (body.checkout?.defaultMethod && !["razorpay", "cod"].includes(body.checkout.defaultMethod)) {
    return NextResponse.json({ error: "Invalid default payment method." }, { status: 400 })
  }
  if (body.paymentLink !== undefined && body.paymentLink.trim() && !URL_PATTERN.test(body.paymentLink.trim())) {
    return NextResponse.json({ error: "Payment Link must be a valid URL starting with http:// or https://." }, { status: 400 })
  }

  const current = await getPaymentSettings()

  const patch: Partial<PaymentSettings> = {
    provider: "razorpay",
    ...(body.keyId !== undefined ? { keyId: body.keyId.trim() } : {}),
    // Blank means "leave the currently stored secret alone" — never overwrite with empty.
    ...(body.keySecret?.trim() ? { keySecret: body.keySecret.trim() } : {}),
    ...(body.webhookSecret?.trim() ? { webhookSecret: body.webhookSecret.trim() } : {}),
    ...(body.paymentLink !== undefined ? { paymentLink: body.paymentLink.trim() } : {}),
  }
  if (body.methods) patch.methods = { ...current.methods, ...body.methods }
  if (body.checkout) patch.checkout = { ...current.checkout, ...body.checkout, currency: "INR" }

  // Credentials cannot be saved unless they actually work — validate format,
  // then confirm the pair authenticates with Razorpay itself, before writing
  // anything. A rejected save touches nothing (the whole request is atomic).
  const credentialsChanging = body.keyId !== undefined || !!body.keySecret?.trim()
  if (credentialsChanging) {
    const keyId = patch.keyId ?? current.keyId
    const keySecret = patch.keySecret ?? current.keySecret

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Both Key ID and Key Secret are required." }, { status: 400 })
    }
    if (!KEY_ID_PATTERN.test(keyId)) {
      return NextResponse.json(
        { error: "Key ID doesn't look like a valid Razorpay key (expected rzp_test_... or rzp_live_...)." },
        { status: 400 },
      )
    }
    if (keySecret.length < 10) {
      return NextResponse.json({ error: "Key Secret looks too short to be valid." }, { status: 400 })
    }

    try {
      await getRazorpayClient(keyId, keySecret).orders.all({ count: 1 })
    } catch (error) {
      const message = (error as { error?: { description?: string } })?.error?.description
      return NextResponse.json({ error: message ?? "Razorpay rejected these credentials." }, { status: 400 })
    }

    // Mode is derived from the key's own prefix, not a separately settable
    // field — there is no "live/test" toggle in the UI anymore, and
    // Razorpay's SDK behavior is already fully determined by which key you
    // hand it, so this is bookkeeping only, not a functional switch.
    patch.mode = keyId.startsWith("rzp_live_") ? "live" : "test"
    // Credentials just proved themselves live — reflect that immediately
    // rather than requiring a separate Verify click right after Save.
    patch.connected = true
    patch.lastVerifiedAt = new Date().toISOString()
  }

  const saved = await savePaymentSettings(patch)

  // Never log the actual secret values — just which fields changed.
  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.payment_update",
    targetType: "settings",
    targetId: "payments",
    after: { fieldsChanged: Object.keys(patch) },
  })

  return NextResponse.json(mask(saved))
}
