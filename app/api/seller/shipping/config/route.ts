import { NextResponse } from "next/server"
import { getIntegrationConfig } from "@/lib/integrations/config-store"

/** Public, unauthenticated — a single non-secret boolean the seller
 * dashboard's Schedule Pickup dialog uses to decide whether to ask for a
 * courier/AWB by hand or just say "Shiprocket will assign this live". */
export async function GET() {
  const config = await getIntegrationConfig("shiprocket")
  const settings = config.settings as { autoAwb?: boolean }
  return NextResponse.json({ autoAwbEnabled: !!config.enabled && !!settings.autoAwb })
}
