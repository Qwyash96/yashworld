import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb, getAdminStorage } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { MediaAsset } from "@/types/media"

type RouteContext = { params: Promise<{ id: string }> }

/** Deletes a Media Library entry — the Storage object AND its catalogue
 * doc. Admin SDK, so this can delete any user's file regardless of who
 * uploaded it (storage.rules' owner-only delete only applies to direct
 * client writes). Used both for "Delete" and, from the UI, right after a
 * successful "Replace" re-upload (delete the old file, the new upload
 * already created its own catalogue entry). */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const ref = getAdminDb().collection("media").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Asset not found." }, { status: 404 })
  const asset = snap.data() as MediaAsset

  try {
    await getAdminStorage().bucket().file(asset.path).delete()
  } catch {
    // Already gone, or a transient Storage hiccup — the catalogue entry is
    // still cleared below, which is what actually matters for the library UI.
  }
  await ref.delete()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "media.delete",
    targetType: "media",
    targetId: id,
    after: { folder: asset.folder, fileName: asset.fileName },
  })

  return NextResponse.json({ ok: true })
}
