import { NextResponse } from "next/server"
import { getGeneralSettings } from "@/lib/platform-settings"

/**
 * The only "Ixoflora business details" every financial document (invoice,
 * receipt, statement) is allowed to print — reused verbatim from the
 * existing General Settings (Admin -> Settings -> General), never invented.
 * No GST/tax-registration field exists anywhere in this project's
 * configuration, so none is fabricated here or in any generated document
 * — see lib/documents/finance-document-context.ts. Public (no auth): a
 * buyer, seller, or admin generating any document client-side all need
 * this, and none of it is sensitive (it's the same info shown in the site
 * footer/contact page).
 */
export async function GET() {
  const settings = await getGeneralSettings()
  return NextResponse.json({
    siteName: settings.siteName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  })
}
