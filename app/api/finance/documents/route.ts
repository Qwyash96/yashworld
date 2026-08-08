import { NextResponse, type NextRequest } from "next/server"
import { requireSignedInUser } from "@/lib/api-auth"
import { requireAnyPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { listFinanceDocuments } from "@/lib/finance-documents"
import type { FinanceDocumentType } from "@/types/finance-document"

/**
 * Lists financial documents scoped to the caller — a buyer or seller only
 * ever sees their OWN (partyType/partyId forced from their verified
 * identity, never taken from the query string); an admin with "payments"
 * or "order_management" may pass partyType/partyId/orderId/type freely
 * ("Finance: Full access according to permissions" — see the permission
 * matrix in the feature spec).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get("orderId") ?? undefined
  const type = (searchParams.get("type") as FinanceDocumentType | null) ?? undefined

  const adminAuth = await requireAnyPermission(request, ["payments", "order_management"])
  if (adminAuth.ok) {
    const documents = await listFinanceDocuments({
      orderId,
      type,
      partyType: (searchParams.get("partyType") as "buyer" | "seller" | null) ?? undefined,
      partyId: searchParams.get("partyId") ?? undefined,
    })
    return NextResponse.json({ documents })
  }

  const userAuth = await requireSignedInUser(request)
  if (!userAuth.ok) return NextResponse.json({ error: userAuth.error }, { status: userAuth.status })

  const sellerAppSnap = await getAdminDb().collection("sellerApplications").doc(userAuth.uid).get()
  const isApprovedSeller = sellerAppSnap.data()?.status === "approved"

  const documents = await listFinanceDocuments({
    orderId,
    type,
    partyType: isApprovedSeller ? "seller" : "buyer",
    partyId: userAuth.uid,
  })
  return NextResponse.json({ documents })
}
