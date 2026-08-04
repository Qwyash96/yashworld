/** Firestore `banners/{id}` — homepage/campaign promotional banners, fully admin-managed. */
export interface Banner {
  id: string
  imageUrl: string
  linkUrl?: string
  title?: string
  startAt?: string
  endAt?: string
  /** Lower sorts first. */
  order: number
  active: boolean
  createdAt: string
}

export type BannerInput = Omit<Banner, "id" | "createdAt">
