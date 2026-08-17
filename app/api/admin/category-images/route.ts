import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

const COLLECTION = "categoryImages"

// The 4 homepage "Shop by Category" cards this feature manages (see
// app/page.tsx's SHOP_BY_CATEGORY_SLUGS) — kept as an allowlist so this
// endpoint can only ever touch these known homepage cards, not become a
// general-purpose category editor (that's Admin → Categories).
const ALLOWED_SLUGS = ["flower-plants", "fruiting-plants", "gardening-tools", "pots-planters"]

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snapshot = await getAdminDb().collection(COLLECTION).get()
  const images: Record<string, string> = {}
  snapshot.docs.forEach((d) => {
    const imageUrl = (d.data() as { imageUrl?: string }).imageUrl
    if (imageUrl) images[d.id] = imageUrl
  })
  return NextResponse.json({ images })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as { slug?: string; imageUrl?: string }
  const slug = body.slug?.trim()
  const imageUrl = body.imageUrl?.trim()

  if (!slug || !ALLOWED_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "Unknown category slug." }, { status: 400 })
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 })
  }

  const db = getAdminDb()
  await db
    .collection(COLLECTION)
    .doc(slug)
    .set({ slug, imageUrl, updatedAt: new Date().toISOString() })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "category_image.update",
    targetType: "categoryImage",
    targetId: slug,
    after: { slug, imageUrl },
  })

  return NextResponse.json({ ok: true })
}
