import { NextResponse, type NextRequest } from "next/server"
import Razorpay from "razorpay"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { getDecryptedCredentials } from "@/lib/integrations/config-store"
import type { SponsoredAd } from "@/types/sponsored-ad"

interface VerifyBody {
  adId?: string
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
}

/**
 * Mirrors app/api/payments/razorpay/verify's exact trust model: never trust
 * the client, only Razorpay's own signature + a fresh payments.fetch() —
 * checked against the amount/order id this specific ad was created with.
 * On success the ad moves pending -> "paid"; it still needs an admin
 * approval (app/api/admin/sponsored-ads/[id]/approve) before it ever runs.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as VerifyBody
  const { adId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
  if (!adId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 })
  }

  const db = getAdminDb()
  const adRef = db.collection("sponsoredAds").doc(adId)
  const adSnap = await adRef.get()
  if (!adSnap.exists) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })

  const ad = adSnap.data() as SponsoredAd
  if (ad.sellerId !== auth.uid) {
    return NextResponse.json({ error: "This promotion doesn't belong to you." }, { status: 403 })
  }
  if (ad.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match this promotion." }, { status: 400 })
  }
  if (ad.status !== "pending") {
    return NextResponse.json({ error: `This promotion is already ${ad.status}.` }, { status: 409 })
  }

  const credentials = await getDecryptedCredentials("razorpay")
  if (!credentials.keyId || !credentials.keySecret) {
    return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 })
  }

  const signatureValid = Razorpay.validateWebhookSignature(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature,
    credentials.keySecret,
  )
  if (!signatureValid) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
  }

  try {
    const payment = await getRazorpayClient(credentials.keyId, credentials.keySecret).payments.fetch(razorpay_payment_id)
    if (payment.order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Payment does not match the order." }, { status: 400 })
    }
    if (payment.status !== "captured") {
      return NextResponse.json({ error: `Payment not captured (status: ${payment.status}).` }, { status: 402 })
    }
    const expectedAmountPaise = Math.round(ad.feeAmount * 100)
    if (Number(payment.amount) !== expectedAmountPaise) {
      return NextResponse.json({ error: "Paid amount does not match the promotion fee." }, { status: 400 })
    }

    await adRef.update({
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify payment." },
      { status: 500 },
    )
  }
}
