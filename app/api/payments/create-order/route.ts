import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { requireSignedInUser } from "@/lib/api-auth"
import { computeTrustedTotal, InsufficientStockError } from "@/lib/order-finalize"
import { createPaymentOrderWithFallback } from "@/lib/payment-router"
import { getPaymentMethodsSettings } from "@/lib/platform-settings"
import type { PaymentInstrument } from "@/lib/integrations/types"
import type { ShippingMethod } from "@/types/order"

interface CreateOrderBody {
  items?: { productId?: string; quantity?: number }[]
  shippingMethod?: ShippingMethod
  couponCode?: string
  method?: PaymentInstrument
  contactEmail?: string
  buyerName?: string
  buyerPhone?: string
}

/**
 * Gateway-agnostic replacement for the old app/api/payments/razorpay/create-order
 * — the customer only ever picks an instrument (UPI/Cards/Net Banking/Wallet/EMI),
 * never a gateway; lib/payment-router.ts (createPaymentOrderWithFallback)
 * decides which enabled+connected gateway actually processes it, trying the
 * next one in priority order if the first fails. The response's `gatewayId`
 * is server-internal routing info for lib/payment-gateway-client.ts to know
 * which checkout SDK/flow to invoke — never rendered as text anywhere.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateOrderBody
  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  if (items.length === 0 || !body.shippingMethod || !body.method || !body.contactEmail?.trim()) {
    return NextResponse.json({ error: "Missing or invalid checkout details." }, { status: 400 })
  }
  if (body.method === "cod") {
    return NextResponse.json({ error: "Use /api/checkout/cod for Cash on Delivery." }, { status: 400 })
  }

  const { methods } = await getPaymentMethodsSettings()
  if (!methods[body.method]) {
    return NextResponse.json({ error: "This payment method isn't available right now." }, { status: 403 })
  }

  try {
    const total = await computeTrustedTotal(items, body.shippingMethod, body.couponCode?.trim())
    const amountPaise = Math.round(total * 100)

    const routed = await createPaymentOrderWithFallback({
      amountPaise,
      currency: "INR",
      receiptId: randomUUID(),
      buyerId: auth.uid,
      buyerEmail: body.contactEmail.trim(),
      buyerPhone: body.buyerPhone?.trim() ?? "",
      buyerName: body.buyerName?.trim() ?? "",
      method: body.method,
      returnUrl: `${request.nextUrl.origin}/checkout?gatewayReturn=1`,
    })

    return NextResponse.json({
      gatewayId: routed.gatewayId,
      gatewayOrderId: routed.gatewayOrderId,
      clientParams: routed.clientParams,
      amount: amountPaise,
      currency: "INR",
    })
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start payment." },
      { status: 500 },
    )
  }
}
