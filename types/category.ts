/** Firestore `categories/{id}` document shape. */
export interface Category {
  id: string
  name: string
  slug: string
  description: string
  image: string
  parentId: string | null
}

export type CategoryInput = Omit<Category, "id">
