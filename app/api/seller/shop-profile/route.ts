import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Seller } from "@/types/seller"

/** A seller's own public storefront branding — sellers/{uid} itself is
 * Admin-SDK-write-only (see firestore.rules), so this is the one
 * sanctioned, narrowly-scoped way a seller can touch their own public
 * profile: exactly logoUrl/bannerUrl, nothing else (shopName/rating/status
 * stay admin-controlled). */
export async function GET(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snap = await getAdminDb().collection("sellers").doc(auth.uid).get()
  if (!snap.exists) return NextResponse.json({ error: "You're not an approved seller yet." }, { status: 403 })
  return NextResponse.json({ seller: { uid: snap.id, ...snap.data() } as Seller })
}

interface PatchBody {
  logoUrl?: string
  bannerUrl?: string
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSignedInUser(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ref = getAdminDb().collection("sellers").doc(auth.uid)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "You're not an approved seller yet." }, { status: 403 })

  const body = (await request.json()) as PatchBody
  const patch: Record<string, unknown> = {}
  if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl
  if (body.bannerUrl !== undefined) patch.bannerUrl = body.bannerUrl

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  await ref.update(patch)
  const updated = await ref.get()
  return NextResponse.json({ seller: { uid: updated.id, ...updated.data() } as Seller })
}
