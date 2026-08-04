import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { requireSignedInUser } from "@/lib/api-auth"
import { finalizeOrder, InsufficientStockError } from "@/lib/order-finalize"
import { getPaymentSettings } from "@/lib/payment-settings"
import type { ShippingMethod } from "@/types/order"

interface CodCheckoutBody {
  items?: { productId?: string; quantity?: number }[]
  contactEmail?: string
  shippingMethod?: ShippingMethod
  couponCode?: string
  shippingAddress?: {
    fullName?: string
    line1?: string
    line2?: string
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

  const body = (await request.json()) as CodCheckoutBody
  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  const address = body.shippingAddress
  if (
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
    return NextResponse.json({ error: "Missing or invalid checkout details." }, { status: 400 })
  }

  const settings = await getPaymentSettings()
  if (!settings.checkout.codEnabled || !settings.methods.cod) {
    return NextResponse.json({ error: "Cash on Delivery isn't available right now." }, { status: 403 })
  }

  try {
    const { orderId } = await finalizeOrder({
      buyerId: auth.uid,
      contactEmail: body.contactEmail.trim(),
      items,
      shippingAddress: {
        id: randomUUID(),
        fullName: address.fullName.trim(),
        line1: address.line1.trim(),
        ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
        phone: address.phone.trim(),
        isDefault: true,
      },
      shippingMethod: body.shippingMethod,
      paymentMethod: "cod",
      paymentStatus: "Pending",
      ...(body.couponCode?.trim() ? { couponCode: body.couponCode.trim() } : {}),
    })

    return NextResponse.json({ orderId })
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place order." },
      { status: 500 },
    )
  }
}
