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
  /** Every uploaded photo, cover first — undefined for the static fallback
   * catalog (single `image` only). Powers the product detail gallery. */
  images?: string[]
  /** The cover photo's real width/height ratio (clamped — see
   * lib/product-images.ts's getImageAspectRatio), used to size the product
   * detail gallery container to the photo's actual shape instead of one
   * fixed ratio for every product. Undefined when the cover image predates
   * this feature (no stored dimensions) — the gallery then falls back to
   * the site's existing default ratio, exactly as before. */
  galleryAspectRatio?: number
  description: string
  details: string[]
  colors: string[]
  sizes: string[]
  rating: number
 reviews: number
  badge?: "New" | "Sale" | "Bestseller"
  /** Owning seller's uid, for real Firestore products. Undefined for the static fallback catalog. */
  sellerId?: string
  /** Joined from sellers/{sellerId}.shopName — see services/catalog.service.ts's attachSellerNames(). */
  sellerName?: string
  /** ISO timestamp, for real Firestore products. Undefined for the static fallback catalog. */
  createdAt?: string
  /** Cumulative units sold — powers the homepage's Best Sellers ranking. Undefined for the static fallback catalog. */
  unitsSold?: number
  /** Real inventory count — undefined for the static fallback catalog (never actually orderable). */
  stock?: number
  /** Raw plant-care attributes (types/product.ts's PlantAttributes), passed
   * through as-is for the product detail page's Product Highlights section
   * to build real label/value specs from — undefined for the static
   * fallback catalog. Every real Firestore product has this regardless of
   * category (no per-category schema yet), so consumers should only treat
   * light/wateringFrequencyDays/difficulty/petSafe as meaningful for actual
   * plant categories; `size` and `indoor` are generic enough to show for
   * any product. */
  plantAttrs?: {
    light: "low" | "medium" | "bright"
    wateringFrequencyDays: number
    petSafe: boolean
    difficulty: "easy" | "moderate" | "hard"
    size: "small" | "medium" | "large"
    indoor: boolean
  }
}
export const categories: Category[] = [
  {
    slug: "plants",
    name: "Plants",
    description: "Our full range of plants",
    image: "/placeholder.svg",
  },
  {
    slug: "indoor-plants",
    name: "Indoor Plants",
    description: "Low-maintenance greenery for every room",
    image: "/placeholder.svg",
  },
  {
    slug: "outdoor-plants",
    name: "Outdoor Plants",
    description: "Hardy plants for gardens, balconies & terraces",
    image: "/placeholder.svg",
  },
  {
    slug: "flower-plants",
    name: "Flower",
    description: "Blooming flowers for every space",
    image: "/placeholder.svg",
  },
  {
    slug: "fruiting-plants",
    name: "Fruit",
    description: "Fruit-bearing plants for your garden",
    image: "/placeholder.svg",
  },
  {
    slug: "pots-planters",
    name: "Pots",
    description: "Ceramic, terracotta & decorative pots",
    image: "/placeholder.svg",
  },
  {
    slug: "plant-care",
    name: "Plant Care",
    description: "Nutrients, soil mixes & plant care essentials",
    image: "/placeholder.svg",
  },
  {
    slug: "gardening-tools",
    name: "Gardening Tools",
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