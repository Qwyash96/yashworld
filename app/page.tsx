import { getProductCatalog, getCategoryCatalog } from "@/services/catalog.service"
import { getActiveBanners } from "@/services/banner.service"
import { getActiveFlashSales } from "@/services/campaign.service"
import { getFeaturedSellers } from "@/services/seller.service"
import { getRunningAdsByPosition } from "@/services/sponsored-ad.service"
import { getTrustBadgesSettings } from "@/lib/platform-settings"
import { calculateDiscountPercent } from "@/lib/discount"
import { HeroSlider } from "@/components/marketplace/hero-slider"
import { CategoryPillBar } from "@/components/marketplace/category-pill-bar"
import { TrustBadges } from "@/components/marketplace/trust-badges"
import { FlashDeals } from "@/components/marketplace/flash-deals"
import { FeaturedSellers } from "@/components/marketplace/featured-sellers"
import { ProductRail } from "@/components/marketplace/product-rail"
import { PromoStrip } from "@/components/marketplace/promo-strip"
import { SponsoredAdSlot } from "@/components/marketplace/sponsored-ad-slot"
import { RecentlyViewedSection } from "@/components/marketplace/recently-viewed-section"
import { FullCatalogBrowser } from "@/components/marketplace/full-catalog-browser"
import { NewsletterSection } from "@/components/marketplace/newsletter-section"
import type { Banner } from "@/types/banner"

/**
 * The homepage — every section below is real, admin-editable, database-
 * backed data (or renders nothing at all): banners from Admin → Banners,
 * categories from Admin → Categories, flash deals from active
 * `flash_sale` campaigns, featured sellers from Admin → Sellers, trust
 * badges from Admin → Settings → General. Trending / Best Sellers / Indoor
 * / Outdoor / New Arrivals / Today's Deals are all derived from the same
 * real product catalog the full browse grid below uses — no separate
 * fetch, no fabricated data.
 */
export default async function HomePage() {
  const [products, categories, banners, flashSales, featuredSellers, trustBadgesSettings, adsByPosition] =
    await Promise.all([
      getProductCatalog(),
      getCategoryCatalog(),
      getActiveBanners(),
      getActiveFlashSales(),
      getFeaturedSellers(),
      getTrustBadgesSettings(),
      getRunningAdsByPosition(),
    ])

  // Position 1 (Top Hero Slider) — a paid seller promotion slots into the
  // same rotation as admin banners, just appended after them (real banners
  // always lead) and ranked among themselves by priority.
  const heroSlides: Banner[] = [
    ...banners,
    ...adsByPosition.hero.map(
      (ad, i): Banner => ({
        id: `ad-${ad.id}`,
        imageUrl: ad.productImage,
        title: ad.productName,
        buttonText: "Shop Now",
        productId: ad.productId,
        order: banners.length + i,
        active: true,
        createdAt: ad.createdAt,
      }),
    ),
  ]

  // Trending: highest rating x review-volume — a simple, honest popularity
  // proxy that needs no separate analytics pipeline.
  const trending = [...products]
    .filter((p) => p.reviews > 0)
    .sort((a, b) => b.rating * b.reviews - a.rating * a.reviews)
    .slice(0, 10)

  // Best Sellers only shows real sales — a marketplace with zero sales yet
  // has no "best sellers" to fabricate, so the section just doesn't render
  // (see ProductRail's empty-array guard).
  const bestSellers = [...products]
    .filter((p) => (p.unitsSold ?? 0) > 0)
    .sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0))
    .slice(0, 10)

  const indoorPlants = products.filter((p) => p.category === "indoor-plants").slice(0, 10)
  const outdoorPlants = products.filter((p) => p.category === "outdoor-plants").slice(0, 10)

  const newArrivals = [...products]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 10)

  const todaysDeals = [...products]
    .filter((p) => calculateDiscountPercent(p.price, p.originalPrice) > 0)
    .sort((a, b) => calculateDiscountPercent(b.price, b.originalPrice) - calculateDiscountPercent(a.price, a.originalPrice))
    .slice(0, 10)

  return (
    <div className="bg-white">
      <HeroSlider banners={heroSlides} />
      <CategoryPillBar categories={categories} />

      {/* Flash Sale / Offers — leads the page right after the hero, per the
       * homepage's intended above-the-fold priority: Hero, Flash Sale, Best
       * Sellers, New Arrivals, then everything else. */}
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

      <ProductRail id="trending" title="Trending Plants" subtitle="Popular with our shoppers right now" products={trending} />

      {/* Position 2 — After Trending */}
      <SponsoredAdSlot ads={adsByPosition["after-trending"]} />

      <PromoStrip banner={banners[1 % banners.length]} />

      <ProductRail id="indoor-plants" title="Indoor Plants" subtitle="Low-maintenance greenery for every room" products={indoorPlants} />
      <ProductRail id="outdoor-plants" title="Outdoor Plants" subtitle="Hardy plants for gardens & terraces" products={outdoorPlants} />

      {/* Position 3 — Middle Banner */}
      <SponsoredAdSlot ads={adsByPosition.middle} />

      <PromoStrip banner={banners[2 % banners.length]} />

      <ProductRail id="todays-deals" title="Today's Deals" subtitle="Biggest discounts on the marketplace right now" products={todaysDeals} />

      <PromoStrip banner={banners[3 % banners.length]} />

      <RecentlyViewedSection />
      <FeaturedSellers sellers={featuredSellers} />

      {/* Position 4 — Bottom Banner */}
      <SponsoredAdSlot ads={adsByPosition.bottom} />

      <FullCatalogBrowser categories={categories} />

      <TrustBadges badges={trustBadgesSettings.badges} />
      <NewsletterSection />
    </div>
  )
}
