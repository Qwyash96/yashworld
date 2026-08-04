import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { SponsoredAd } from "@/types/sponsored-ad"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snap = await getAdminDb().collection("sponsoredAds").orderBy("createdAt", "desc").get()
  const ads = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SponsoredAd)
  return NextResponse.json({ ads })
}
