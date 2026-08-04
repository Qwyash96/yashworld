import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { Banner, BannerInput } from "@/types/banner"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snap = await getAdminDb().collection("banners").orderBy("order", "asc").get()
  const banners = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Banner)
  return NextResponse.json({ banners })
}

interface CreateBody {
  imageUrl?: string
  linkUrl?: string
  title?: string
  subtitle?: string
  buttonText?: string
  productId?: string
  startAt?: string
  endAt?: string
  order?: number
  active?: boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as CreateBody
  if (!body.imageUrl?.trim()) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 })
  }

  const input: BannerInput = {
    imageUrl: body.imageUrl.trim(),
    ...(body.linkUrl?.trim() ? { linkUrl: body.linkUrl.trim() } : {}),
    ...(body.title?.trim() ? { title: body.title.trim() } : {}),
    ...(body.subtitle?.trim() ? { subtitle: body.subtitle.trim() } : {}),
    ...(body.buttonText?.trim() ? { buttonText: body.buttonText.trim() } : {}),
    ...(body.productId?.trim() ? { productId: body.productId.trim() } : {}),
    ...(body.startAt ? { startAt: body.startAt } : {}),
    ...(body.endAt ? { endAt: body.endAt } : {}),
    order: body.order ?? 0,
    active: body.active ?? true,
  }

  const ref = await getAdminDb()
    .collection("banners")
    .add({ ...input, createdAt: new Date().toISOString() })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "banner.create",
    targetType: "banner",
    targetId: ref.id,
  })

  return NextResponse.json({ id: ref.id })
}
