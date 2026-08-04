import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getCoupon } from "@/lib/coupons"
import { writeAuditLog } from "@/lib/audit-log"
import type { CouponStatus } from "@/types/coupon"

type RouteContext = { params: Promise<{ code: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { code } = await params
  const coupon = await getCoupon(code)
  if (!coupon || coupon.scope !== "global") {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 })
  }
  return NextResponse.json({ coupon })
}

interface PatchBody {
  discountValue?: number
  maxDiscountAmount?: number
  minOrderValue?: number
  usageLimit?: number
  usageLimitPerBuyer?: number
  startAt?: string
  endAt?: string
  status?: CouponStatus
  bannerImageUrl?: string
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { code } = await params
  const coupon = await getCoupon(code)
  if (!coupon || coupon.scope !== "global") {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 })
  }

  const body = (await request.json()) as PatchBody
  if (coupon.discountType === "percent" && (body.discountValue ?? coupon.discountValue) > 100) {
    return NextResponse.json({ error: "A percent discount cannot exceed 100." }, { status: 400 })
  }
  if (body.startAt && body.endAt && new Date(body.startAt) >= new Date(body.endAt)) {
    return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const key of [
    "discountValue",
    "maxDiscountAmount",
    "minOrderValue",
    "usageLimit",
    "usageLimitPerBuyer",
    "startAt",
    "endAt",
    "status",
    "bannerImageUrl",
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  await getAdminDb().collection("coupons").doc(code.toUpperCase()).update(patch)
  const updated = await getCoupon(code)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "coupon.update",
    targetType: "coupon",
    targetId: code,
    after: patch,
  })

  return NextResponse.json({ coupon: updated })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { code } = await params
  const coupon = await getCoupon(code)
  if (!coupon || coupon.scope !== "global") {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 })
  }

  await getAdminDb().collection("coupons").doc(code.toUpperCase()).delete()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "coupon.delete",
    targetType: "coupon",
    targetId: code,
  })

  return NextResponse.json({ ok: true })
}
