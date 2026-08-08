import { NextResponse, type NextRequest } from "next/server"
import { requireAnyPermission } from "@/lib/admin-api-auth"
import { getAdjustment } from "@/lib/finance-adjustment-service"
import { getFinanceDocument } from "@/lib/finance-documents"

type RouteContext = { params: Promise<{ id: string }> }

/** One adjustment's full detail, plus its generated document's metadata
 * (document number etc.) if it's been approved — everything the Finance
 * Admin UI needs to render a Debit/Credit/Adjustment Statement PDF client-side. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAnyPermission(request, ["payments", "order_management"])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const adjustment = await getAdjustment(id)
  if (!adjustment) return NextResponse.json({ error: "Adjustment not found." }, { status: 404 })

  const document = adjustment.relatedDocumentId ? await getFinanceDocument(adjustment.relatedDocumentId) : null

  return NextResponse.json({ adjustment, document })
}
