import { getProductCatalog, getCategoryCatalog } from "@/services/catalog.service"
import { getActiveBanners } from "@/services/banner.service"
import { getActiveFlashSales } from "@/services/campaign.service"
import { getFeaturedSellers } from "@/services/seller.service"
import { getTrustBadgesSettings } from "@/lib/platform-settings"
import { calculateDiscountPercent } from "@/lib/discount"
import { HeroSlider } from "@/components/marketplace/hero-slider"
import { CategoryPillBar } from "@/components/marketplace/category-pill-bar"
import { TrustBadges } from "@/components/marketplace/trust-badges"
import { FlashDeals } from "@/components/marketplace/flash-deals"
import { FeaturedSellers } from "@/components/marketplace/featured-sellers"
import { ProductRail } from "@/components/marketplace/product-rail"
import { RecentlyViewedSection } from "@/components/marketplace/recently-viewed-section"
import { FullCatalogBrowser } from "@/components/marketplace/full-catalog-browser"
import { NewsletterSection } from "@/components/marketplace/newsletter-section"

// Otherwise statically baked at build time with no refresh at all (no
// dynamic input on this route) — a deleted/edited banner, or any other
// admin change reflected here, would never show up without a full
// redeploy. Matches the same 60s ISR contract app/products/page.tsx and
// app/categories/page.tsx already use for the same reason.
export const revalidate = 60

/**
 * The homepage — every section below is real, admin-editable, database-
 * backed data (or renders nothing at all): banners from Admin → Banners,
 * categories from Admin → Categories, flash deals from active
 * `flash_sale` campaigns, featured sellers from Admin → Sellers, trust
 * badges from Admin → Settings → General. Trending / Best Sellers / Indoor
 * / Outdoor / New Arrivals / Today's Deals are all derived from the same
 * real product catalog the full browse grid below uses — no separate
 * fetch, no fabricated data.
 *
 * Structure: Header/Search (site chrome) → Category Bar → ONE hero banner
 * slider → Best Sellers → New Arrivals → Today's Deals → Featured
 * (Indoor/Outdoor) → Trending → Recently Viewed → everything else. The
 * hero banner never repeats anywhere else on the page — no promo strips,
 * no ad strips scattered between rails (see git history if that's ever
 * wanted back as a proper native "Sponsored" card in a rail instead).
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
    .slice(0, 10)

  const newArrivals = [...products]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 10)

  const todaysDeals = [...products]
    .filter((p) => calculateDiscountPercent(p.price, p.originalPrice) > 0)
    .sort((a, b) => calculateDiscountPercent(b.price, b.originalPrice) - calculateDiscountPercent(a.price, a.originalPrice))
    .slice(0, 10)

  const indoorPlants = products.filter((p) => p.category === "indoor-plants").slice(0, 10)
  const outdoorPlants = products.filter((p) => p.category === "outdoor-plants").slice(0, 10)

  // Trending: highest rating x review-volume — a simple, honest popularity
  // proxy that needs no separate analytics pipeline.
  const trending = [...products]
    .filter((p) => p.reviews > 0)
    .sort((a, b) => b.rating * b.reviews - a.rating * a.reviews)
    .slice(0, 10)

  return (
    <div className="bg-white">
      <CategoryPillBar categories={categories} />

      <HeroSlider banners={banners} />

      <FlashDeals campaigns={flashSales} />

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

      <ProductRail id="todays-deals" title="Today's Deals" subtitle="Biggest discounts on the marketplace right now" products={todaysDeals} />

      <ProductRail id="indoor-plants" title="Featured: Indoor Plants" subtitle="Low-maintenance greenery for every room" products={indoorPlants} />
      <ProductRail id="outdoor-plants" title="Featured: Outdoor Plants" subtitle="Hardy plants for gardens & terraces" products={outdoorPlants} />

      <ProductRail id="trending" title="Trending Plants" subtitle="Popular with our shoppers right now" products={trending} />

      <RecentlyViewedSection />

      <FeaturedSellers sellers={featuredSellers} />

      <FullCatalogBrowser categories={categories} />

      <TrustBadges badges={trustBadgesSettings.badges} />
      <NewsletterSection />
    </div>
  )
}
