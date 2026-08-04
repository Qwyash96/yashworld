import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { storage } from "@/services/firebase/client"
import { registerMediaAsset } from "@/lib/media-library"
import { compressImage } from "@/lib/image-compression"
import type { MediaFolder } from "@/types/media"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPE_PATTERN = /^image\/|^application\/pdf$/
// Simple uploadBytes() calls can hang past their normal retry window if the
// underlying bucket/network never resolves at all (as opposed to failing
// fast with an HTTP error) — race it against a timeout so the UI always
// reaches an error state instead of spinning forever.
const UPLOAD_TIMEOUT_MS = 30_000

function friendlyStorageError(error: unknown): string {
  const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : undefined
  switch (code) {
    case "storage/unauthorized":
      return "You don't have permission to upload this file. Please sign in again and retry."
    case "storage/unauthenticated":
      return "Your session expired. Please sign in again and retry."
    case "storage/quota-exceeded":
      return "Storage quota has been exceeded. Please contact support."
    case "storage/retry-limit-exceeded":
    case "storage/unknown":
      return "Could not reach file storage. Please check your connection and try again, or contact support if this keeps happening."
    case "storage/canceled":
      return "Upload was canceled."
    default:
      return error instanceof Error && error.message ? error.message : "Upload failed. Please try again."
  }
}

/**
 * Uploads a seller KYC document to `seller-kyc/{uid}/{docKey}.{ext}` —
 * a fixed name per document type, so resubmission overwrites the previous
 * file instead of accumulating orphans. Returns the storage path (not a
 * download URL); mint one on demand via `getDownloadURL` when needed.
 * Deliberately NOT registered in the Media Library — KYC documents are
 * private and must never surface in a reusable image picker.
 */
export async function uploadSellerKycDoc(uid: string, docKey: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is too large — the maximum size is 10 MB.`)
  }
  if (!ACCEPTED_TYPE_PATTERN.test(file.type)) {
    throw new Error(`"${file.name}" must be an image or a PDF.`)
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
  const path = `seller-kyc/${uid}/${docKey}.${ext}`

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            "Upload timed out. Please check your connection and try again, or contact support if this keeps happening.",
          ),
        ),
      UPLOAD_TIMEOUT_MS,
    )
  })

  try {
    await Promise.race([uploadBytes(ref(storage, path), file, { contentType: file.type }), timeout])
    return path
  } catch (error) {
    throw new Error(`Failed to upload "${docKey}": ${friendlyStorageError(error)}`)
  }
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_TYPE_PATTERN = /^image\/(jpeg|jpg|png|webp)$/

/**
 * The one real upload implementation behind every folder-specific
 * `upload*Image` export below: validates, compresses, uploads to
 * `{folder}/{uid}/{uuid}.{ext}` with real progress reporting, catalogues the
 * result into the Media Library (best-effort), and returns the public
 * download URL. Adding a new image surface to the app means adding one new
 * thin wrapper here, not reimplementing this.
 */
async function uploadImage(
  folder: MediaFolder,
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large — the maximum size is 10 MB.`)
  }
  if (!IMAGE_TYPE_PATTERN.test(file.type)) {
    throw new Error(`"${file.name}" must be a JPG, PNG or WEBP image.`)
  }

  const originalName = file.name
  const compressed = await compressImage(file)
  const ext = compressed.name.includes(".") ? compressed.name.split(".").pop() : "jpg"
  const path = `${folder}/${uid}/${crypto.randomUUID()}.${ext}`
  const task = uploadBytesResumable(ref(storage, path), compressed, { contentType: compressed.type })

  const url = await new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (error) => {
        reject(new Error(`Failed to upload "${originalName}": ${friendlyStorageError(error)}`))
      },
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref))
        } catch (error) {
          reject(new Error(`Failed to upload "${originalName}": ${friendlyStorageError(error)}`))
        }
      },
    )
  })

  void registerMediaAsset({
    url,
    path,
    folder,
    fileName: originalName,
    sizeBytes: compressed.size,
    contentType: compressed.type,
    uploadedBy: uid,
  })

  return url
}

/** Product gallery images — `product-images/{uid}/{uuid}.{ext}`. */
export async function uploadProductImage(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("product-images", uid, file, onProgress)
}

/** Homepage hero / promo banner images — `banner-images/{uid}/{uuid}.{ext}`. */
export async function uploadBannerImage(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("banner-images", uid, file, onProgress)
}

/** Category thumbnail images — `category-images/{uid}/{uuid}.{ext}`. */
export async function uploadCategoryImage(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("category-images", uid, file, onProgress)
}

/** A seller's public storefront logo — `seller-logos/{uid}/{uuid}.{ext}`. */
export async function uploadSellerLogo(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("seller-logos", uid, file, onProgress)
}

/** A seller's public storefront banner — `seller-banners/{uid}/{uuid}.{ext}`. */
export async function uploadSellerBanner(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("seller-banners", uid, file, onProgress)
}

/** A buyer/seller's account profile photo — `profile-photos/{uid}/{uuid}.{ext}`. */
export async function uploadProfilePhoto(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("profile-photos", uid, file, onProgress)
}

/** A support ticket screenshot/attachment — `support-images/{uid}/{uuid}.{ext}`. */
export async function uploadSupportImage(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("support-images", uid, file, onProgress)
}

/** A coupon/offer promotional banner — `coupon-banners/{uid}/{uuid}.{ext}`. */
export async function uploadCouponBanner(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("coupon-banners", uid, file, onProgress)
}

/** The platform's own site logo (Admin → Settings → Branding) — `site-branding/{uid}/{uuid}.{ext}`. */
export async function uploadSiteBrandLogo(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("site-branding", uid, file, onProgress)
}

/** A buyer's product review photo — `review-images/{uid}/{uuid}.{ext}`. */
export async function uploadReviewImage(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  return uploadImage("review-images", uid, file, onProgress)
}

/** Best-effort cleanup when an uploaded image is removed — never blocks the UI on failure. */
export async function deleteProductImage(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url))
  } catch {
    // Already gone, or a permissions/network hiccup — the Firestore write
    // (dropping this URL from the owning document) is what actually matters.
  }
}
