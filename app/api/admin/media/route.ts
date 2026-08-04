import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { MediaAsset } from "@/types/media"

// Newest 2000 files — plenty of headroom for this marketplace's real scale;
// flagged explicitly rather than silently under-reporting storage usage
// past this cap if the library ever grows beyond it.
const LIST_LIMIT = 2000

/** Admin → Media library listing — every uploaded file across the whole
 * app, newest first (up to LIST_LIMIT). Optionally filtered by folder via
 * ?folder=. Search by filename happens client-side. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const folder = request.nextUrl.searchParams.get("folder")
  const db = getAdminDb()
  const ref = folder
    ? db.collection("media").where("folder", "==", folder).orderBy("uploadedAt", "desc").limit(LIST_LIMIT)
    : db.collection("media").orderBy("uploadedAt", "desc").limit(LIST_LIMIT)

  const snap = await ref.get()
  const assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MediaAsset)
  const totalBytes = assets.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0)
  return NextResponse.json({ assets, totalBytes, truncated: assets.length === LIST_LIMIT })
}
