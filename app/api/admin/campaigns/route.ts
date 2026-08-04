import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { listCampaigns } from "@/lib/campaigns"
import { writeAuditLog } from "@/lib/audit-log"
import type { CampaignInput, CampaignType, CampaignEnrollmentMode, DiscountType } from "@/types/campaign"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const campaigns = await listCampaigns()
  return NextResponse.json({ campaigns })
}

const CAMPAIGN_TYPES: CampaignType[] = ["flash_sale", "festival_sale", "category_discount", "deal_of_day"]
const DISCOUNT_TYPES: DiscountType[] = ["percent", "flat"]
const ENROLLMENT_MODES: CampaignEnrollmentMode[] = ["open", "invite_only"]

interface CreateBody {
  name?: string
  type?: CampaignType
  discountType?: DiscountType
  discountValue?: number
  categoryIds?: string[]
  startAt?: string
  endAt?: string
  enrollmentMode?: CampaignEnrollmentMode
  bannerImageUrl?: string
  bannerLinkUrl?: string
  maxDiscountAmount?: number
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateBody

  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!body.type || !CAMPAIGN_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid campaign type." }, { status: 400 })
  }
  if (!body.discountType || !DISCOUNT_TYPES.includes(body.discountType)) {
    return NextResponse.json({ error: "Invalid discount type." }, { status: 400 })
  }
  if (typeof body.discountValue !== "number" || body.discountValue <= 0) {
    return NextResponse.json({ error: "Discount value must be greater than 0." }, { status: 400 })
  }
  if (body.discountType === "percent" && body.discountValue > 100) {
    return NextResponse.json({ error: "A percent discount cannot exceed 100." }, { status: 400 })
  }
  if (!body.startAt || !body.endAt || new Date(body.startAt) >= new Date(body.endAt)) {
    return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 })
  }
  if (!body.enrollmentMode || !ENROLLMENT_MODES.includes(body.enrollmentMode)) {
    return NextResponse.json({ error: "Invalid enrollment mode." }, { status: 400 })
  }

  const now = new Date()
  const status = new Date(body.endAt) < now ? "ended" : new Date(body.startAt) > now ? "scheduled" : "active"

  const input: CampaignInput = {
    name: body.name.trim(),
    type: body.type,
    discountType: body.discountType,
    discountValue: body.discountValue,
    ...(body.categoryIds?.length ? { categoryIds: body.categoryIds } : {}),
    startAt: body.startAt,
    endAt: body.endAt,
    status,
    enrollmentMode: body.enrollmentMode,
    ...(body.bannerImageUrl ? { bannerImageUrl: body.bannerImageUrl } : {}),
    ...(body.bannerLinkUrl ? { bannerLinkUrl: body.bannerLinkUrl } : {}),
    ...(body.maxDiscountAmount ? { maxDiscountAmount: body.maxDiscountAmount } : {}),
    createdBy: auth.uid,
  }

  const nowIso = now.toISOString()
  const ref = await getAdminDb()
    .collection("campaigns")
    .add({ ...input, stats: { ordersCount: 0, revenue: 0, discountGiven: 0 }, createdAt: nowIso, updatedAt: nowIso })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "campaign.create",
    targetType: "campaign",
    targetId: ref.id,
    after: { name: input.name, type: input.type },
  })

  return NextResponse.json({ id: ref.id })
}
