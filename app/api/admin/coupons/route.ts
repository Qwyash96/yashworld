import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { listCoupons } from "@/lib/coupons"
import type { CouponInput } from "@/types/coupon"
import type { DiscountType } from "@/types/campaign"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const coupons = await listCoupons("global")
  return NextResponse.json({ coupons })
}

const CODE_PATTERN = /^[A-Z0-9]{3,20}$/

interface CreateBody {
  code?: string
  discountType?: DiscountType
  discountValue?: number
  maxDiscountAmount?: number
  minOrderValue?: number
  usageLimit?: number
  usageLimitPerBuyer?: number
  startAt?: string
  endAt?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateBody
  const code = body.code?.trim().toUpperCase()

  if (!code || !CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Code must be 3-20 uppercase letters/numbers." }, { status: 400 })
  }
  if (!body.discountType || (body.discountType !== "percent" && body.discountType !== "flat")) {
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

  const db = getAdminDb()
  const ref = db.collection("coupons").doc(code)
  const existing = await ref.get()
  if (existing.exists) {
    return NextResponse.json({ error: `Code "${code}" is already in use.` }, { status: 409 })
  }

  const now = new Date().toISOString()
  const input: CouponInput = {
    code,
    scope: "global",
    discountType: body.discountType,
    discountValue: body.discountValue,
    ...(body.maxDiscountAmount ? { maxDiscountAmount: body.maxDiscountAmount } : {}),
    ...(body.minOrderValue ? { minOrderValue: body.minOrderValue } : {}),
    ...(body.usageLimit ? { usageLimit: body.usageLimit } : {}),
    ...(body.usageLimitPerBuyer ? { usageLimitPerBuyer: body.usageLimitPerBuyer } : {}),
    startAt: body.startAt,
    endAt: body.endAt,
    status: "active",
    createdBy: auth.uid,
  }

  await ref.set({ ...input, usedCount: 0, totalDiscountGiven: 0, totalRevenue: 0, createdAt: now, updatedAt: now })
  return NextResponse.json({ code })
}
