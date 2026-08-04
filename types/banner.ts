/** Firestore `banners/{id}` — homepage/campaign promotional banners, fully admin-managed. */
export interface Banner {
  id: string
  imageUrl: string
  linkUrl?: string
  title?: string
  subtitle?: string
  buttonText?: string
  /** Overrides linkUrl when set — the banner links straight to a product page. */
  productId?: string
  startAt?: string
  endAt?: string
  /** Lower sorts first — also the drag-and-drop reorder position. */
  order: number
  active: boolean
  createdAt: string
}

export type BannerInput = Omit<Banner, "id" | "createdAt">
