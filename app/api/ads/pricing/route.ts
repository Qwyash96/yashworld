import { NextResponse } from "next/server"
import { getAdPricingSettings } from "@/lib/platform-settings"

/** Public — a seller needs to see the fee for each duration before starting
 * a promotion. platformSettings/adPricing itself is fully locked to direct
 * client reads (see firestore.rules), so this is the one sanctioned way to
 * surface it, same shape as app/api/checkout/config. */
export async function GET() {
  const pricing = await getAdPricingSettings()
  return NextResponse.json({ feeByDurationDays: pricing.feeByDurationDays })
}
