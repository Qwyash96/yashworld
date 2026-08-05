import type { MetadataRoute } from "next"
import { getCategoryCatalog, getProductCatalog } from "@/services/catalog.service"

const SITE_URL = "https://www.yashworld.shop"

const STATIC_ROUTES = ["", "/products", "/categories", "/about", "/contact", "/sell", "/privacy", "/refund-policy", "/shipping-policy"]

/** Real Firestore-backed catalog data (via the same services/catalog.service.ts
 * every buyer page already uses), not a hardcoded list — new products and
 * categories show up here automatically as they're approved. Every private/
 * authenticated route is intentionally excluded, matching app/robots.ts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProductCatalog(), getCategoryCatalog()])

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }))

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/categories/${category.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/products/${product.id}`,
    ...(product.createdAt ? { lastModified: new Date(product.createdAt) } : {}),
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [...staticEntries, ...categoryEntries, ...productEntries]
}
