import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

type RouteContext = { params: Promise<{ id: string }> }

interface PatchBody {
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const ref = getAdminDb().collection("banners").doc(id)
  const existing = await ref.get()
  if (!existing.exists) {
    return NextResponse.json({ error: "Banner not found." }, { status: 404 })
  }

  const body = (await request.json()) as PatchBody
  if (body.imageUrl !== undefined && !body.imageUrl.trim()) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const key of [
    "imageUrl",
    "linkUrl",
    "title",
    "subtitle",
    "buttonText",
    "productId",
    "startAt",
    "endAt",
    "order",
    "active",
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  await ref.update(patch)
  const updated = await ref.get()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "banner.update",
    targetType: "banner",
    targetId: id,
    after: patch,
  })

  return NextResponse.json({ banner: { id: updated.id, ...updated.data() } })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await getAdminDb().collection("banners").doc(id).delete()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "banner.delete",
    targetType: "banner",
    targetId: id,
  })

  return NextResponse.json({ ok: true })
}
