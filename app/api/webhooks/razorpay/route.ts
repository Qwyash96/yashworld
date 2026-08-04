import { NextResponse, type NextRequest } from "next/server"
import Razorpay from "razorpay"
import { getAdminDb } from "@/lib/firebase-admin"
import { getPaymentSettings } from "@/lib/payment-settings"

/**
 * Razorpay webhook receiver — configured in the Razorpay Dashboard against
 * this URL with the same secret stored as `webhookSecret` in Payment
 * Settings. This is a reconciliation safety net, not the primary order-
 * creation path: app/api/payments/razorpay/verify already creates the order
 * synchronously when the buyer's browser completes checkout. This only
 * updates paymentStatus on an existing order (matched by razorpayOrderId) if
 * one exists — it never creates an order itself, so a buyer who closes the
 * tab mid-payment still can't get an order without a genuinely verified
 * payment.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-razorpay-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 })
  }

  const settings = await getPaymentSettings()
  if (!settings.webhookSecret) {
    return NextResponse.json({ error: "Webhook secret isn't configured." }, { status: 503 })
  }

  const valid = Razorpay.validateWebhookSignature(rawBody, signature, settings.webhookSecret)
  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 })
  }

  const event = JSON.parse(rawBody) as {
    event?: string
    payload?: { payment?: { entity?: { order_id?: string } } }
  }

  const razorpayOrderId = event.payload?.payment?.entity?.order_id
  const newStatus =
    event.event === "payment.captured" ? "Paid" : event.event === "payment.failed" ? "Failed" : null

  if (razorpayOrderId && newStatus) {
    const db = getAdminDb()
    const matches = await db.collection("orders").where("razorpayOrderId", "==", razorpayOrderId).limit(1).get()
    if (!matches.empty) {
      await matches.docs[0].ref.update({ paymentStatus: newStatus })
    }
  }

  return NextResponse.json({ ok: true })
}
