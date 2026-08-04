import { getProductCatalog, getCategoryCatalog } from "@/services/catalog.service"
import { getActiveBanners } from "@/services/banner.service"
import { getActiveFlashSales } from "@/services/campaign.service"
import { getFeaturedSellers } from "@/services/seller.service"
import { getTrustBadgesSettings } from "@/lib/platform-settings"
import { HeroSlider } from "@/components/marketplace/hero-slider"
import { AiSearchBar } from "@/components/marketplace/ai-search-bar"
import { TrustBadges } from "@/components/marketplace/trust-badges"
import { CategoryGrid } from "@/components/marketplace/category-grid"
import { FlashDeals } from "@/components/marketplace/flash-deals"
import { FeaturedSellers } from "@/components/marketplace/featured-sellers"
import { ProductRail } from "@/components/marketplace/product-rail"
import { FullCatalogBrowser } from "@/components/marketplace/full-catalog-browser"
import { NewsletterSection } from "@/components/marketplace/newsletter-section"

/**
 * The homepage — every section below is real, admin-editable, database-
 * backed data (or renders nothing at all): banners from Admin → Banners,
 * categories from Admin → Categories, flash deals from active
 * `flash_sale` campaigns, featured sellers from Admin → Sellers, trust
 * badges from Admin → Settings → General. Best Sellers / New Arrivals /
 * Recommended are derived from the same real product catalog the full
 * browse grid below uses — no separate fetch, no fabricated data.
 */
export default async function HomePage() {
  const [products, categories, banners, flashSales, featuredSellers, trustBadgesSettings] = await Promise.all([
    getProductCatalog(),
    getCategoryCatalog(),
    getActiveBanners(),
    getActiveFlashSales(),
    getFeaturedSellers(),
    getTrustBadgesSettings(),
  ])

  // Best Sellers only shows real sales — a marketplace with zero sales yet
  // has no "best sellers" to fabricate, so the section just doesn't render
  // (see ProductRail's empty-array guard).
  const bestSellers = [...products]
    .filter((p) => (p.unitsSold ?? 0) > 0)
    .sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0))
    .slice(0, 8)

  const newArrivals = [...products]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 8)

  const shownIds = new Set([...bestSellers, ...newArrivals].map((p) => p.id))
  const recommended = products.filter((p) => !shownIds.has(p.id)).slice(0, 8)

  return (
    <div className="bg-white">
      <HeroSlider banners={banners} />
      <AiSearchBar categories={categories} />
      <TrustBadges badges={trustBadgesSettings.badges} />
      <CategoryGrid categories={categories} />
      <FlashDeals campaigns={flashSales} />
      <FeaturedSellers sellers={featuredSellers} />
      <ProductRail
        id="best-sellers"
        title="Best Sellers"
        subtitle="Most-loved by our customers"
        products={bestSellers}
        viewAllHref="/products"
      />
      <ProductRail
        id="new-arrivals"
        title="New Arrivals"
        subtitle="Freshly listed by our sellers"
        products={newArrivals}
        viewAllHref="/products"
      />
      <ProductRail title="Recommended For You" subtitle="Handpicked from our marketplace" products={recommended} />
      <FullCatalogBrowser categories={categories} />
      <NewsletterSection />
    </div>
  )
}
