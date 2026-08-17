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
 * The one low-level upload primitive every `upload*Image` export ultimately
 * goes through: uploads `blob` to `{folder}/{uid}/{uuid}.{ext}` with real
 * progress reporting and a friendly error on failure, returning the public
 * download URL. Doesn't validate, compress, or catalogue — callers that
 * need those (i.e. every export below) layer them on top; this just moves
 * one already-decided file into Storage, which is also why
 * uploadProductImage (below) can call it twice — original and compressed —
 * without duplicating the upload/progress/error logic itself.
 */
async function uploadBlobToPath(
  folder: MediaFolder,
  uid: string,
  blob: Blob,
  contentType: string,
  ext: string,
  originalName: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string; path: string }> {
  const path = `${folder}/${uid}/${crypto.randomUUID()}.${ext}`
  const task = uploadBytesResumable(ref(storage, path), blob, { contentType })

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

  return { url, path }
}

function fileExt(name: string): string {
  return name.includes(".") ? name.split(".").pop()! : "jpg"
}

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

  const compressed = await compressImage(file)
  const { url, path } = await uploadBlobToPath(folder, uid, compressed, compressed.type, fileExt(compressed.name), file.name, onProgress)

  void registerMediaAsset({
    url,
    path,
    folder,
    fileName: file.name,
    sizeBytes: compressed.size,
    contentType: compressed.type,
    uploadedBy: uid,
  })

  return url
}

/** Direct folder upload for Admin → Media's own "Upload"/"Replace" actions,
 * where the destination folder is chosen in the UI rather than fixed by a
 * specific feature. */
export async function uploadToMediaFolder(
  folder: MediaFolder,
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return uploadImage(folder, uid, file, onProgress)
}

export interface ProductImageUploadResult {
  /** Compressed, web-optimized version — `product-images/{uid}/{uuid}.{ext}`, same path/shape as before this feature. */
  url: string
  /** The untouched upload, preserved for future reprocessing — `product-images-original/{uid}/{uuid}.{ext}`. */
  originalUrl: string
  /** Natural pixel dimensions of the upload, read once here so the gallery can size itself to the photo's real aspect ratio. */
  width: number
  height: number
}

/**
 * Product gallery images. Uploads the real, unmodified original (for
 * future reprocessing — e.g. if a better compression pipeline ships later,
 * or a size no longer fits, it can be regenerated from this instead of a
 * lossy re-compress of the already-compressed display copy) alongside the
 * existing compressed display version, and reads the photo's natural pixel
 * dimensions once so the UI never has to guess an aspect ratio. Progress
 * reporting spans both uploads (0-40% original, 40-100% compressed) so the
 * caller's single progress bar still reads as one continuous upload.
 */
export async function uploadProductImage(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ProductImageUploadResult> {
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large — the maximum size is 10 MB.`)
  }
  if (!IMAGE_TYPE_PATTERN.test(file.type)) {
    throw new Error(`"${file.name}" must be a JPG, PNG or WEBP image.`)
  }

  let width: number, height: number
  try {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    bitmap.close()
  } catch {
    throw new Error(`"${file.name}" doesn't look like a valid image file.`)
  }

  const { url: originalUrl } = await uploadBlobToPath(
    "product-images-original",
    uid,
    file,
    file.type,
    fileExt(file.name),
    file.name,
    (percent) => onProgress?.(Math.round(percent * 0.4)),
  )

  const compressed = await compressImage(file)
  const { url, path } = await uploadBlobToPath(
    "product-images",
    uid,
    compressed,
    compressed.type,
    fileExt(compressed.name),
    file.name,
    (percent) => onProgress?.(40 + Math.round(percent * 0.6)),
  )

  void registerMediaAsset({
    url,
    path,
    folder: "product-images",
    fileName: file.name,
    sizeBytes: compressed.size,
    contentType: compressed.type,
    uploadedBy: uid,
  })

  return { url, originalUrl, width, height }
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

/** Best-effort cleanup when an uploaded image is removed — never blocks the
 * UI on failure. Also removes the paired original (product-images-original)
 * when one exists; pre-existing images that never had one just skip it. */
export async function deleteProductImage(url: string, originalUrl?: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url))
  } catch {
    // Already gone, or a permissions/network hiccup — the Firestore write
    // (dropping this URL from the owning document) is what actually matters.
  }
  if (originalUrl) {
    try {
      await deleteObject(ref(storage, originalUrl))
    } catch {
      // Same reasoning as above.
    }
  }
}
