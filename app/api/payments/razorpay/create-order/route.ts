import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { requireSignedInUser } from "@/lib/api-auth"
import { computeTrustedTotal, InsufficientStockError } from "@/lib/order-finalize"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import type { ShippingMethod } from "@/types/order"

interface CreateOrderBody {
  items?: { productId?: string; quantity?: number }[]
  shippingMethod?: ShippingMethod
  couponCode?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateOrderBody
  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  if (items.length === 0 || !body.shippingMethod) {
    return NextResponse.json({ error: "Missing or invalid checkout details." }, { status: 400 })
  }

  const [config, credentials] = await Promise.all([getIntegrationConfig("razorpay"), getDecryptedCredentials("razorpay")])
  const settings = config.settings as { razorpayEnabled: boolean } & Record<string, boolean | string>
  if (!settings.razorpayEnabled) {
    return NextResponse.json({ error: "Razorpay checkout isn't available right now." }, { status: 403 })
  }
  if (!credentials.keyId || !credentials.keySecret) {
    return NextResponse.json({ error: "Razorpay isn't configured." }, { status: 503 })
  }

  try {
    const total = await computeTrustedTotal(items, body.shippingMethod, body.couponCode?.trim())
    const amountPaise = Math.round(total * 100)

    const razorpayOrder = await getRazorpayClient(credentials.keyId, credentials.keySecret).orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: randomUUID(),
      notes: { buyerId: auth.uid },
    })

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      keyId: credentials.keyId,
      methods: {
        upi: settings.upi,
        cards: settings.cards,
        netbanking: settings.netbanking,
        wallet: settings.wallet,
        emi: settings.emi,
        cod: settings.cod,
      },
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
