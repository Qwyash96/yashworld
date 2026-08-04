import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getAdPricingSettings } from "@/lib/platform-settings"
import { getRazorpayClient } from "@/lib/razorpay-admin"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import { normalizeProductImages, getCoverImageUrl } from "@/lib/product-images"
import { AD_DURATION_OPTIONS, AD_POSITIONS, type AdDurationDays, type AdPosition } from "@/types/sponsored-ad"
import type { SponsoredAd } from "@/types/sponsored-ad"

interface CreateBody {
  productId?: string
  durationDays?: AdDurationDays
  position?: AdPosition
}

/**
 * Starts a seller's "Promote Product" purchase — mirrors
 * app/api/payments/razorpay/create-order exactly: the fee is looked up
 * server-side (platformSettings/adPricing), never trusted from the client,
 * and the sponsoredAds doc is created at "pending" before payment even
 * starts, so a failed/abandoned checkout just leaves a pending row instead
 * of losing the seller's intent.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateBody
  if (!body.productId || !body.durationDays || !AD_DURATION_OPTIONS.includes(body.durationDays)) {
    return NextResponse.json({ error: "Missing or invalid product/duration." }, { status: 400 })
  }
  const position: AdPosition = body.position && AD_POSITIONS.includes(body.position) ? body.position : "after-trending"

  const db = getAdminDb()
  const productSnap = await db.collection("products").doc(body.productId).get()
  if (!productSnap.exists) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 })
  }
  const product = productSnap.data()!
  if (product.sellerId !== auth.uid) {
    return NextResponse.json({ error: "You can only promote your own products." }, { status: 403 })
  }
  if (product.status !== "approved") {
    return NextResponse.json({ error: "Only approved, live products can be promoted." }, { status: 400 })
  }

  const pricing = await getAdPricingSettings()
  const feeAmount = pricing.feeByDurationDays[String(body.durationDays) as "1" | "3" | "7" | "15" | "30"]

  const [config, credentials] = await Promise.all([getIntegrationConfig("razorpay"), getDecryptedCredentials("razorpay")])
  const settings = config.settings as { razorpayEnabled: boolean }
  if (!settings.razorpayEnabled) {
    return NextResponse.json({ error: "Payments aren't available right now." }, { status: 403 })
  }
  if (!credentials.keyId || !credentials.keySecret) {
    return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 })
  }

  const productImage = getCoverImageUrl(normalizeProductImages(product.images)) ?? ""
  const nowIso = new Date().toISOString()
  const adInput: Omit<SponsoredAd, "id"> = {
    sellerId: auth.uid,
    productId: body.productId,
    productName: product.name ?? "",
    productImage,
    durationDays: body.durationDays,
    feeAmount,
    position,
    status: "pending",
    priority: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  const adRef = await db.collection("sponsoredAds").add(adInput)

  try {
    const amountPaise = Math.round(feeAmount * 100)
    const razorpayOrder = await getRazorpayClient(credentials.keyId, credentials.keySecret).orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: randomUUID(),
      notes: { sellerId: auth.uid, adId: adRef.id, kind: "sponsored_ad" },
    })

    await adRef.update({ razorpayOrderId: razorpayOrder.id, updatedAt: new Date().toISOString() })

    return NextResponse.json({
      adId: adRef.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      keyId: credentials.keyId,
    })
  } catch (error) {
    await adRef.delete()
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start payment." },
      { status: 500 },
    )
  }
}
