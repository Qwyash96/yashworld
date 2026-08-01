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
}

export const categories: Category[] = [
  {
    slug: "apparel",
    name: "Apparel",
    description: "Considered essentials cut from premium fabrics.",
    image: "/images/product-jacket.png",
  },
  {
    slug: "footwear",
    name: "Footwear",
    description: "Minimal silhouettes engineered for everyday wear.",
    image: "/images/product-sneaker.png",
  },
  {
    slug: "bags",
    name: "Bags",
    description: "Structured carry, made from full-grain leather.",
    image: "/images/product-bag.png",
  },
  {
    slug: "watches",
    name: "Watches",
    description: "Timepieces reduced to their purest form.",
    image: "/images/product-watch.png",
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "The finishing details that define a look.",
    image: "/images/product-sunglasses.png",
  },
]

export const products: Product[] = [
  {
    id: "wool-overcoat",
    name: "Monolith Wool Overcoat",
    price: 620,
    originalPrice: 780,
    category: "apparel",
    image: "/images/product-jacket.png",
    description:
      "A tailored double-faced wool overcoat with a clean, elongated silhouette. Fully lined and finished with horn buttons.",
    details: ["100% virgin wool", "Fully lined body", "Horn button closure", "Dry clean only"],
    colors: ["Black", "Charcoal"],
    sizes: ["XS", "S", "M", "L", "XL"],
    rating: 4.8,
    reviews: 142,
    badge: "Sale",
  },
  {
    id: "cotton-tee",
    name: "Essential Heavyweight Tee",
    price: 68,
    category: "apparel",
    image: "/images/product-tshirt.png",
    description:
      "A heavyweight organic cotton tee with a boxy fit and reinforced collar. The foundation of a considered wardrobe.",
    details: ["240gsm organic cotton", "Boxy relaxed fit", "Ribbed collar", "Machine washable"],
    colors: ["White", "Black"],
    sizes: ["XS", "S", "M", "L", "XL"],
    rating: 4.7,
    reviews: 318,
    badge: "Bestseller",
  },
  {
    id: "black-hoodie",
    name: "Shadow Fleece Hoodie",
    price: 148,
    category: "apparel",
    image: "/images/product-hoodie.png",
    description:
      "A brushed-back fleece hoodie with a heavyweight drawcord hood and a clean, minimal front.",
    details: ["380gsm brushed fleece", "Kangaroo pocket", "Ribbed cuffs and hem", "Machine washable"],
    colors: ["Black", "Ash"],
    sizes: ["S", "M", "L", "XL"],
    rating: 4.6,
    reviews: 96,
    badge: "New",
  },
  {
    id: "leather-sneaker",
    name: "Blanc Leather Sneaker",
    price: 210,
    category: "footwear",
    image: "/images/product-sneaker.png",
    description:
      "A minimal low-top sneaker in Italian leather with a tonal rubber sole and hidden lacing.",
    details: ["Italian full-grain leather", "Rubber cupsole", "Leather lining", "Made in Portugal"],
    colors: ["White"],
    sizes: ["39", "40", "41", "42", "43", "44"],
    rating: 4.9,
    reviews: 204,
    badge: "Bestseller",
  },
  {
    id: "chelsea-boot",
    name: "Onyx Chelsea Boot",
    price: 340,
    category: "footwear",
    image: "/images/product-boot.png",
    description:
      "A sleek Chelsea boot in polished black leather with elastic side gussets and a stacked heel.",
    details: ["Polished calf leather", "Elastic side panels", "Leather sole", "Goodyear welted"],
    colors: ["Black"],
    sizes: ["39", "40", "41", "42", "43", "44"],
    rating: 4.7,
    reviews: 87,
  },
  {
    id: "leather-tote",
    name: "Structure Leather Tote",
    price: 395,
    category: "bags",
    image: "/images/product-bag.png",
    description:
      "A structured tote in full-grain leather with a suede-lined interior and a magnetic closure.",
    details: ["Full-grain leather", "Suede lining", "Interior zip pocket", "Magnetic closure"],
    colors: ["Black"],
    sizes: ["One Size"],
    rating: 4.8,
    reviews: 61,
    badge: "New",
  },
  {
    id: "bifold-wallet",
    name: "Slate Bifold Wallet",
    price: 120,
    category: "accessories",
    image: "/images/product-wallet.png",
    description:
      "A slim bifold wallet in vegetable-tanned leather with six card slots and a full-length note pocket.",
    details: ["Vegetable-tanned leather", "Six card slots", "Note compartment", "RFID protection"],
    colors: ["Black"],
    sizes: ["One Size"],
    rating: 4.6,
    reviews: 133,
  },
  {
    id: "acetate-sunglasses",
    name: "Eclipse Acetate Sunglasses",
    price: 165,
    category: "accessories",
    image: "/images/product-sunglasses.png",
    description:
      "A bold acetate frame with polarized lenses and a keyhole bridge, hand-finished in Italy.",
    details: ["Italian acetate frame", "Polarized lenses", "UV400 protection", "Includes hard case"],
    colors: ["Black"],
    sizes: ["One Size"],
    rating: 4.5,
    reviews: 74,
  },
  {
    id: "leather-belt",
    name: "Meridian Leather Belt",
    price: 95,
    category: "accessories",
    image: "/images/product-belt.png",
    description:
      "A refined leather belt with a matte black buckle and hand-burnished edges.",
    details: ["Full-grain leather", "Matte black buckle", "Hand-burnished edges", "35mm width"],
    colors: ["Black"],
    sizes: ["S", "M", "L", "XL"],
    rating: 4.7,
    reviews: 58,
  },
  {
    id: "field-watch",
    name: "Noir Field Watch",
    price: 480,
    originalPrice: 560,
    category: "watches",
    image: "/images/product-watch.png",
    description:
      "An automatic field watch with a blacked-out dial, sapphire crystal, and a supple leather strap.",
    details: ["Automatic movement", "Sapphire crystal", "100m water resistance", "Italian leather strap"],
    colors: ["Black"],
    sizes: ["One Size"],
    rating: 4.9,
    reviews: 112,
    badge: "Sale",
  },
  {
    id: "canvas-cap",
    name: "Baseline Canvas Cap",
    price: 55,
    category: "accessories",
    image: "/images/product-cap.png",
    description:
      "A six-panel cap in washed cotton canvas with an adjustable metal clasp and a low-profile crown.",
    details: ["Washed cotton canvas", "Adjustable clasp", "Low-profile crown", "One size fits most"],
    colors: ["Black"],
    sizes: ["One Size"],
    rating: 4.4,
    reviews: 41,
  },
  {
    id: "merino-knit",
    name: "Ivory Merino Knit",
    price: 185,
    category: "apparel",
    image: "/images/product-tshirt.png",
    description:
      "A fine-gauge merino wool crewneck with a clean rib finish and a soft, breathable hand-feel.",
    details: ["Extra-fine merino wool", "Ribbed trims", "Regular fit", "Hand wash cold"],
    colors: ["Ivory", "Black"],
    sizes: ["XS", "S", "M", "L", "XL"],
    rating: 4.6,
    reviews: 69,
    badge: "New",
  },
]

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.category === slug)
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug)
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
  )
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value)
}
