/** Every Firebase Storage top-level folder used across the app — the single
 * source of truth for both services/storage.service.ts (which folder to
 * upload into) and storage.rules (which folders are valid upload targets). */
export const MEDIA_FOLDERS = [
  "product-images",
  "banner-images",
  "category-images",
  "seller-logos",
  "seller-banners",
  "profile-photos",
  "support-images",
  "coupon-banners",
  "site-branding",
  "review-images",
  "ad-creatives",
] as const

export type MediaFolder = (typeof MEDIA_FOLDERS)[number]

/**
 * Firestore `media/{id}` — one entry per uploaded file, written automatically
 * by services/storage.service.ts right after a successful upload. Powers
 * the Admin → Media library (search/reuse/delete/storage-usage) without
 * needing to scan Storage directly, which has no query API.
 */
export interface MediaAsset {
  id: string
  url: string
  /** Storage path — needed to delete/replace the underlying object. */
  path: string
  folder: MediaFolder
  fileName: string
  sizeBytes: number
  contentType: string
  uploadedBy: string
  uploadedAt: string
}
