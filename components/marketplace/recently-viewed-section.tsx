"use client"

import { useStore } from "@/components/store-provider"
import { ProductRail } from "@/components/marketplace/product-rail"

/** Real, per-browser view history (localStorage via StoreProvider) — a
 * client component since this data can't be fetched server-side. Renders
 * nothing until the shopper has actually viewed something. */
export function RecentlyViewedSection() {
  const { recentlyViewed, getProductById } = useStore()
  const products = recentlyViewed.map((id) => getProductById(id)).filter((p): p is NonNullable<typeof p> => !!p)

  return <ProductRail id="recently-viewed" title="Recently Viewed" subtitle="Pick up where you left off" products={products.slice(0, 12)} />
}
