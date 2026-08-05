import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import Razorpay from "razorpay"
import { requireSignedInUser } from "@/lib/api-auth"
import { computeTrustedTotal, finalizeOrder, InsufficientStockError, DuplicatePaymentError } from "@/lib/order-finalize"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import type { ShippingMethod } from "@/types/order"

interface VerifyBody {
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  items?: { productId?: string; quantity?: number }[]
  contactEmail?: string
  shippingMethod?: ShippingMethod
  couponCode?: string
  shippingAddress?: {
    id?: string
    fullName?: string
    line1?: string
    line2?: string
    landmark?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    phone?: string
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as VerifyBody
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  const address = body.shippingAddress
  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    items.length === 0 ||
    !body.contactEmail?.trim() ||
    !body.shippingMethod ||
    !address?.fullName?.trim() ||
    !address.line1?.trim() ||
    !address.city?.trim() ||
    !address.state?.trim() ||
    !address.postalCode?.trim() ||
    !address.country?.trim() ||
    !address.phone?.trim()
  ) {
    return NextResponse.json({ error: "Missing or invalid payment/checkout details." }, { status: 400 })
  }

  const [config, credentials] = await Promise.all([getIntegrationConfig("razorpay"), getDecryptedCredentials("razorpay")])
  const settings = config.settings as { razorpayEnabled: boolean }
  if (!settings.razorpayEnabled) {
    return NextResponse.json({ error: "Razorpay checkout isn't available right now." }, { status: 403 })
  }
  if (!credentials.keyId || !credentials.keySecret) {
    return NextResponse.json({ error: "Razorpay isn't configured." }, { status: 503 })
  }

  // 1. Cryptographic proof this order_id/payment_id pair is genuine.
  const signatureValid = Razorpay.validateWebhookSignature(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature,
    credentials.keySecret,
  )
  if (!signatureValid) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
  }

  try {
    // 2. Confirm the payment actually captured, for this order, at the amount we expect —
    //    never trust the client's word for any of this, only Razorpay's own API.
    const payment = await getRazorpayClient(credentials.keyId, credentials.keySecret).payments.fetch(razorpay_payment_id)
    if (payment.order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Payment does not match the order." }, { status: 400 })
    }
    if (payment.status !== "captured") {
      return NextResponse.json({ error: `Payment not captured (status: ${payment.status}).` }, { status: 402 })
    }

    const expectedTotal = await computeTrustedTotal(items, body.shippingMethod, body.couponCode?.trim())
    const expectedAmountPaise = Math.round(expectedTotal * 100)
    if (Number(payment.amount) !== expectedAmountPaise) {
      return NextResponse.json({ error: "Paid amount does not match the order total." }, { status: 400 })
    }

    // 3. Only now — payment cryptographically verified, captured, and for the right amount — create the order.
    const { orderId } = await finalizeOrder({
      buyerId: auth.uid,
      contactEmail: body.contactEmail.trim(),
      items,
      shippingAddress: {
        id: address!.id || randomUUID(),
        fullName: address!.fullName!.trim(),
        line1: address!.line1!.trim(),
        ...(address!.line2?.trim() ? { line2: address!.line2.trim() } : {}),
        ...(address!.landmark?.trim() ? { landmark: address!.landmark.trim() } : {}),
        city: address!.city!.trim(),
        state: address!.state!.trim(),
        postalCode: address!.postalCode!.trim(),
        country: address!.country!.trim(),
        phone: address!.phone!.trim(),
        isDefault: true,
      },
      shippingMethod: body.shippingMethod,
      paymentMethod: "razorpay",
      paymentStatus: "Paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      ...(body.couponCode?.trim() ? { couponCode: body.couponCode.trim() } : {}),
    })

    return NextResponse.json({ orderId })
  } catch (error) {
    if (error instanceof DuplicatePaymentError) {
      // Idempotent retry — this exact Razorpay payment already created an
      // order (the checkout handler firing twice, a network retry resending
      // the same POST). Return the same order instead of creating a second
      // one for a single real payment.
      return NextResponse.json({ orderId: error.existingOrderId })
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify payment." },
      { status: 500 },
    )
  }
}
