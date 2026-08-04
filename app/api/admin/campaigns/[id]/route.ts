import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getCampaign, clearCampaignOfferFromProducts } from "@/lib/campaigns"
import { writeAuditLog } from "@/lib/audit-log"
import type { CampaignStatus, CampaignEnrollmentMode, DiscountType } from "@/types/campaign"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })
  return NextResponse.json({ campaign })
}

interface PatchBody {
  name?: string
  discountType?: DiscountType
  discountValue?: number
  categoryIds?: string[]
  startAt?: string
  endAt?: string
  status?: CampaignStatus
  enrollmentMode?: CampaignEnrollmentMode
  bannerImageUrl?: string
  bannerLinkUrl?: string
  maxDiscountAmount?: number
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })

  const body = (await request.json()) as PatchBody
  if (body.discountType && body.discountType === "percent" && (body.discountValue ?? campaign.discountValue) > 100) {
    return NextResponse.json({ error: "A percent discount cannot exceed 100." }, { status: 400 })
  }
  if (body.startAt && body.endAt && new Date(body.startAt) >= new Date(body.endAt)) {
    return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const key of [
    "name",
    "discountType",
    "discountValue",
    "categoryIds",
    "startAt",
    "endAt",
    "status",
    "enrollmentMode",
    "bannerImageUrl",
    "bannerLinkUrl",
    "maxDiscountAmount",
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  await getAdminDb().collection("campaigns").doc(id).update(patch)

  // If the campaign was just cancelled/ended, or its window/discount
  // changed such that it's no longer trustworthy, clear the denormalized
  // price from every product that had joined — never let a stale
  // campaignOffer keep being shown/charged past this point.
  const becameInactive = body.status === "cancelled" || body.status === "ended"
  const economicsChanged = body.discountType !== undefined || body.discountValue !== undefined || body.endAt !== undefined
  if (becameInactive || economicsChanged) {
    await clearCampaignOfferFromProducts(id)
  }

  const updated = await getCampaign(id)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "campaign.update",
    targetType: "campaign",
    targetId: id,
    after: patch,
  })

  return NextResponse.json({ campaign: updated })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })

  await clearCampaignOfferFromProducts(id)
  await getAdminDb().collection("campaigns").doc(id).delete()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "campaign.delete",
    targetType: "campaign",
    targetId: id,
    before: { name: campaign.name },
  })

  return NextResponse.json({ ok: true })
}
