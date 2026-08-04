export type Category = {
  slug: string
  name: string
  description: string
  image: string
}

export type Product = {
  id: string
  name: string
  price: number
  originalPrice?: number
  category: string
  image: string
  description: string
  details: string[]
  colors: string[]
  sizes: string[]
  rating: number
 reviews: number
  badge?: "New" | "Sale" | "Bestseller"
  /** Owning seller's uid, for real Firestore products. Undefined for the static fallback catalog. */
  sellerId?: string
  /** ISO timestamp, for real Firestore products. Undefined for the static fallback catalog. */
  createdAt?: string
}
export const categories: Category[] = [
  {
    slug: "plants",
    name: "🌿 Plants",
    description: "Our full range of plants",
    image: "/placeholder.svg",
  },
  {
    slug: "indoor-plants",
    name: "🪴 Indoor Plants",
    description: "Low-maintenance greenery for every room",
    image: "/placeholder.svg",
  },
  {
    slug: "outdoor-plants",
    name: "🌳 Outdoor Plants",
    description: "Hardy plants for gardens, balconies & terraces",
    image: "/placeholder.svg",
  },
  {
    slug: "pots-planters",
    name: "🏺 Pots & Planters",
    description: "Ceramic, terracotta & decorative planters",
    image: "/placeholder.svg",
  },
  {
    slug: "plant-care",
    name: "🌱 Plant Care",
    description: "Nutrients, soil mixes & plant care essentials",
    image: "/placeholder.svg",
  },
  {
    slug: "gardening-tools",
    name: "🛠 Gardening Tools",
    description: "Everything you need to tend your garden",
    image: "/placeholder.svg",
  },
]
export const products: Product[] = []
export const featuredProducts = products.slice(0, 8)

export const newArrivals = products.slice(0, 8)
export function getProduct(id: string) {
  return products.find((p) => p.id === id)
}

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug)
}

export function getProductsByCategory(category: string) {
  return products.filter((p) => p.category === category)
}

export function formatPrice(price: number) {
  return `₹${price.toLocaleString("en-IN")}`
}
export function searchProducts(query: string) {
  const search = query.toLowerCase().trim()

  if (!search) return products

  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(search) ||
      product.description.toLowerCase().includes(search) ||
      product.category.toLowerCase().includes(search)
    )
  })
}