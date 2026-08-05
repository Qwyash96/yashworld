import type { MetadataRoute } from "next"

const SITE_URL = "https://www.yashworld.shop"

/** Buyer-facing catalog pages stay crawlable; every authenticated/private
 * surface (admin, seller dashboard, cart, checkout, account pages, and the
 * API itself) is disallowed — none of it is meant to be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/api", "/cart", "/checkout", "/orders", "/profile", "/wishlist"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
