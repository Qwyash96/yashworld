import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { storage } from "@/services/firebase/client"

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

const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const PRODUCT_IMAGE_TYPE_PATTERN = /^image\/(jpeg|jpg|png|webp)$/

/**
 * Uploads one product image to `product-images/{uid}/{uuid}.{ext}` — a
 * unique filename per image (unlike KYC docs, a seller can have many of
 * these at once, added/removed independently) — and returns its public
 * download URL, which is what gets stored in Firestore. Reports real
 * upload progress via onProgress (0-100) using a resumable upload.
 */
export async function uploadProductImage(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large — the maximum size is 10 MB.`)
  }
  if (!PRODUCT_IMAGE_TYPE_PATTERN.test(file.type)) {
    throw new Error(`"${file.name}" must be a JPG, PNG or WEBP image.`)
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg"
  const path = `product-images/${uid}/${crypto.randomUUID()}.${ext}`
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })

  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (error) => {
        reject(new Error(`Failed to upload "${file.name}": ${friendlyStorageError(error)}`))
      },
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref))
        } catch (error) {
          reject(new Error(`Failed to upload "${file.name}": ${friendlyStorageError(error)}`))
        }
      },
    )
  })
}

/**
 * Uploads a promotional banner image to `banner-images/{uid}/{uuid}.{ext}` —
 * same shape as uploadProductImage. Real access control lives in
 * firestore.rules (the `banners` collection itself is Admin-SDK-write-only),
 * so this storage path only needs to keep uploads owner-scoped.
 */
export async function uploadBannerImage(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error(`"${file.name}" is too large — the maximum size is 10 MB.`)
  }
  if (!PRODUCT_IMAGE_TYPE_PATTERN.test(file.type)) {
    throw new Error(`"${file.name}" must be a JPG, PNG or WEBP image.`)
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg"
  const path = `banner-images/${uid}/${crypto.randomUUID()}.${ext}`
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })

  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (error) => {
        reject(new Error(`Failed to upload "${file.name}": ${friendlyStorageError(error)}`))
      },
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref))
        } catch (error) {
          reject(new Error(`Failed to upload "${file.name}": ${friendlyStorageError(error)}`))
        }
      },
    )
  })
}

/** Best-effort cleanup when a seller removes an image — never blocks the UI on failure. */
export async function deleteProductImage(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url))
  } catch {
    // Already gone, or a permissions/network hiccup — the Firestore write
    // (dropping this URL from the product) is what actually matters.
  }
}
