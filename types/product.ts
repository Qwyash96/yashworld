export type ProductStatus = "draft" | "active" | "out_of_stock" | "archived"

export type LightRequirement = "low" | "medium" | "bright"
export type CareDifficulty = "easy" | "moderate" | "hard"
export type PlantSize = "small" | "medium" | "large"

export interface PlantAttributes {
  light: LightRequirement
  wateringFrequencyDays: number
  petSafe: boolean
  difficulty: CareDifficulty
  size: PlantSize
  indoor: boolean
}

/**
 * Firestore `products/{id}` document shape.
 * `lib/products.ts` still owns the current runtime Product type used by the UI;
 * this is the target shape for when Product Management goes live.
 */
export interface Product {
  id: string
  sellerId: string
  name: string
  slug: string
  categoryId: string
  price: number
  originalPrice?: number
  stock: number
  images: string[]
  description: string
  plantAttrs: PlantAttributes
  status: ProductStatus
  ratingAvg: number
  ratingCount: number
  createdAt: string
}

export type ProductInput = Omit<Product, "id" | "ratingAvg" | "ratingCount" | "createdAt">
