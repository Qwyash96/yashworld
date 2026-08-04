import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { participantId } from "@/lib/campaigns"
import { calculateDiscountAmount } from "@/lib/pricing-engine"
import type { Campaign, CampaignParticipant } from "@/types/campaign"
import type { Product } from "@/types/product"

type RouteContext = { params: Promise<{ id: string }> }

interface JoinBody {
  /** Which of the seller's own products to enroll — omit/empty for "all my eligible products". */
  productIds?: string[]
}

const ACTIVE_STATUSES = new Set<Campaign["status"]>(["scheduled", "active"])

/**
 * The one seller-side campaign write that needs a trusted server-side price
 * computation (every other seller write — coupons, declining an invite,
 * scheduled offers — goes direct-to-Firestore under firestore.rules). Joining
 * atomically flips campaignParticipants to "opted_in" and denormalizes the
 * computed campaign price onto each enrolled product.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: campaignId } = await params
  const db = getAdminDb()
  const sellerId = auth.uid

  const applicationSnap = await db.collection("sellerApplications").doc(sellerId).get()
  if (applicationSnap.data()?.status !== "approved") {
    return NextResponse.json({ error: "Only approved sellers can join campaigns." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as JoinBody
  const requestedProductIds = (body.productIds ?? []).filter((id): id is string => typeof id === "string" && !!id)

  try {
    const result = await db.runTransaction(async (tx) => {
      const campaignRef = db.collection("campaigns").doc(campaignId)
      const participantRef = db.collection("campaignParticipants").doc(participantId(campaignId, sellerId))
      const productsQuery = db.collection("products").where("sellerId", "==", sellerId).where("status", "==", "approved")

      const [campaignSnap, participantSnap, productsSnap] = await Promise.all([
        tx.get(campaignRef),
        tx.get(participantRef),
        tx.get(productsQuery),
      ])

      if (!campaignSnap.exists) throw new Error("Campaign not found.")
      const campaign = { id: campaignSnap.id, ...campaignSnap.data() } as Campaign

      if (!ACTIVE_STATUSES.has(campaign.status)) {
        throw new Error("This campaign isn't open for enrollment right now.")
      }
      if (new Date(campaign.endAt) < new Date()) {
        throw new Error("This campaign has already ended.")
      }

      const existingParticipant = participantSnap.exists ? (participantSnap.data() as CampaignParticipant) : null
      if (campaign.enrollmentMode === "invite_only" && existingParticipant?.status !== "invited" && existingParticipant?.status !== "opted_in") {
        throw new Error("This campaign is invite-only — you haven't been invited.")
      }

      const ownedProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
      let eligibleProducts = campaign.categoryIds?.length
        ? ownedProducts.filter((p) => campaign.categoryIds!.includes(p.categoryId))
        : ownedProducts

      if (requestedProductIds.length > 0) {
        const eligibleIds = new Set(eligibleProducts.map((p) => p.id))
        const invalid = requestedProductIds.filter((id) => !eligibleIds.has(id))
        if (invalid.length > 0) {
          throw new Error(`These products aren't eligible for this campaign: ${invalid.join(", ")}`)
        }
        eligibleProducts = eligibleProducts.filter((p) => requestedProductIds.includes(p.id))
      }

      if (eligibleProducts.length === 0) {
        throw new Error("You have no eligible products to enroll in this campaign.")
      }

      const now = new Date().toISOString()
      for (const product of eligibleProducts) {
        const basePrice = product.originalPrice ?? product.price
        const discount = calculateDiscountAmount(basePrice, campaign.discountType, campaign.discountValue, campaign.maxDiscountAmount)
        const campaignPrice = Math.round((basePrice - discount) * 100) / 100
        tx.update(db.collection("products").doc(product.id), {
          campaignOffer: { campaignId, price: campaignPrice, endAt: campaign.endAt },
        })
      }

      const participant: CampaignParticipant = {
        campaignId,
        sellerId,
        status: "opted_in",
        ...(requestedProductIds.length > 0 ? { productIds: requestedProductIds } : {}),
        ...(existingParticipant?.invitedAt ? { invitedAt: existingParticipant.invitedAt } : {}),
        respondedAt: now,
      }
      tx.set(participantRef, participant)

      return { enrolledCount: eligibleProducts.length }
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join campaign."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
