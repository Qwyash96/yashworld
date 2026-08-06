import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { requireSignedInUser } from "@/lib/api-auth"
import { computeTrustedTotal, finalizeOrder, InsufficientStockError, DuplicatePaymentError } from "@/lib/order-finalize"
import { verifyPaymentForGateway } from "@/lib/payment-router"
import type { PaymentGatewayId, ShippingMethod } from "@/types/order"

interface VerifyBody {
  gatewayId?: PaymentGatewayId
  gatewayOrderId?: string
  /** Gateway-specific proof-of-payment fields returned by its own checkout
   * flow — e.g. Razorpay's {razorpay_payment_id, razorpay_signature}. Empty
   * for gateways verified purely by a server-to-server order-status lookup
   * (Cashfree/PhonePe/PayU/Stripe/PayPal all verify by gatewayOrderId alone). */
  payload?: Record<string, string>
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

/**
 * Gateway-agnostic replacement for the old app/api/payments/razorpay/verify —
 * verification always targets whichever gatewayId the matching create-order
 * call actually returned (never re-routed by priority; a payment already in
 * flight with one gateway must be verified against that same gateway).
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as VerifyBody
  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  const address = body.shippingAddress
  if (
    !body.gatewayId ||
    !body.gatewayOrderId ||
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

  try {
    const expectedTotal = await computeTrustedTotal(items, body.shippingMethod, body.couponCode?.trim())
    const expectedAmountPaise = Math.round(expectedTotal * 100)

    const verifyResult = await verifyPaymentForGateway(body.gatewayId, {
      gatewayOrderId: body.gatewayOrderId,
      payload: body.payload ?? {},
      expectedAmountPaise,
    })
    if (!verifyResult.ok) {
      return NextResponse.json({ error: verifyResult.message ?? "Payment verification failed." }, { status: verifyResult.status === "pending" ? 402 : 400 })
    }

    const { orderId } = await finalizeOrder({
      buyerId: auth.uid,
      contactEmail: body.contactEmail.trim(),
      items,
      shippingAddress: {
        id: address.id || randomUUID(),
        fullName: address.fullName.trim(),
        ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
        ...(address.landmark?.trim() ? { landmark: address.landmark.trim() } : {}),
        line1: address.line1.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
        phone: address.phone.trim(),
        isDefault: true,
      },
      shippingMethod: body.shippingMethod,
      paymentMethod: body.gatewayId,
      paymentStatus: "Paid",
      gatewayId: body.gatewayId,
      gatewayOrderId: body.gatewayOrderId,
      gatewayPaymentId: verifyResult.gatewayPaymentId,
      ...(body.couponCode?.trim() ? { couponCode: body.couponCode.trim() } : {}),
    })

    return NextResponse.json({ orderId })
  } catch (error) {
    if (error instanceof DuplicatePaymentError) {
      // Idempotent retry — this exact payment already created an order (the
      // checkout handler firing twice, a network retry re-sending the same
      // request). Return the same order instead of creating a second one.
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
