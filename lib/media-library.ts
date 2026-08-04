import { collection, addDoc, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import type { MediaAsset, MediaFolder } from "@/types/media"

/** Called automatically by every services/storage.service.ts upload
 * function right after a successful upload — never blocks or fails the
 * upload itself if this write fails (best-effort cataloguing). */
export async function registerMediaAsset(input: {
  url: string
  path: string
  folder: MediaFolder
  fileName: string
  sizeBytes: number
  contentType: string
  uploadedBy: string
}): Promise<void> {
  try {
    await addDoc(collection(db, "media"), { ...input, uploadedAt: new Date().toISOString() })
  } catch (error) {
    console.error("[media-library] failed to register asset:", error)
  }
}

/** The signed-in user's own uploaded media — powers "Choose from Library"
 * pickers on seller/buyer-facing upload widgets (their own past uploads
 * only; the full cross-user library is Admin → Media, via the Admin-SDK
 * routes in app/api/admin/media). */
export async function getOwnMediaAssets(uid: string, folder?: MediaFolder): Promise<MediaAsset[]> {
  try {
    const constraints = folder
      ? [where("uploadedBy", "==", uid), where("folder", "==", folder)]
      : [where("uploadedBy", "==", uid)]
    const snapshot = await getDocs(query(collection(db, "media"), ...constraints, orderBy("uploadedAt", "desc"), limit(60)))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MediaAsset)
  } catch (error) {
    console.error("[media-library] failed to list own assets:", error)
    return []
  }
}
