import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { computeOrderPricing, InsufficientStockError } from "@/lib/pricing-engine"
import { getShippingRate } from "@/lib/shipping"
import type { ShippingMethod } from "@/types/order"

interface PreviewBody {
  items?: { productId?: string; quantity?: number }[]
  shippingMethod?: ShippingMethod
  couponCode?: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Read-only preview of the same trusted pricing engine used at checkout —
 * lets the checkout page show live discount/coupon feedback (and reject a
 * bad code) before payment, without duplicating any pricing logic client-side.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as PreviewBody
  const items = (body.items ?? [])
    .filter((i): i is { productId: string; quantity: number } => !!i.productId && !!i.quantity && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: i.quantity }))

  if (items.length === 0 || !body.shippingMethod) {
    return NextResponse.json({ error: "Missing or invalid checkout details." }, { status: 400 })
  }

  const couponCode = body.couponCode?.trim()

  try {
    const pricing = await computeOrderPricing(items, { couponCode })
    if (couponCode && !pricing.appliedCouponCode) {
      return NextResponse.json({ error: "This coupon code isn't valid for your cart." }, { status: 400 })
    }

    const shipping = getShippingRate(body.shippingMethod, pricing.subtotal)
    const total = round2(pricing.subtotal - pricing.discount + shipping)

    return NextResponse.json({
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping,
      total,
      appliedCouponCode: pricing.appliedCouponCode ?? null,
      items: pricing.items.map((item) => ({
        productId: item.productId,
        unitPrice: item.unitPrice,
        originalUnitPrice: item.originalUnitPrice,
        discountSource: item.discountSource,
      })),
    })
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to price your cart." },
      { status: 500 },
    )
  }
}
