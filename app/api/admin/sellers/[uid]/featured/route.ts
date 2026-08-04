import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

interface FeaturedBody {
  featured?: boolean
}

/** Toggles a seller's homepage "Featured Sellers" placement — only ever
 * meaningful for an already-approved seller (sellers/{uid} only exists post-
 * approval), so this is safe to leave callable regardless of status. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await requireAdminPermission(request, "seller_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const body = (await request.json()) as FeaturedBody
  if (typeof body.featured !== "boolean") {
    return NextResponse.json({ error: "featured must be a boolean." }, { status: 400 })
  }

  const db = getAdminDb()
  const ref = db.collection("sellers").doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Seller not found." }, { status: 404 })

  await ref.update({ featured: body.featured })

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: body.featured ? "seller.feature" : "seller.unfeature",
    targetType: "seller",
    targetId: uid,
    after: { featured: body.featured },
  })

  return NextResponse.json({ ok: true })
}
