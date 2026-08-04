import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb, getAdminStorage } from "@/lib/firebase-admin"

type RouteContext = { params: Promise<{ uid: string; docKey: string }> }

const DOC_KEY_FIELD: Record<string, string> = {
  aadhaarFront: "aadhaarFrontPath",
  aadhaarBack: "aadhaarBackPath",
  pan: "panPath",
  selfie: "selfiePath",
  bankProof: "bankProofPath",
  gst: "gstPath",
}

/** Mints a short-lived signed URL for one KYC document — the only way an
 * admin ever reads seller-kyc/** files, since Storage rules only allow the
 * owner direct access. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "seller_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid, docKey } = await params
  const field = DOC_KEY_FIELD[docKey]
  if (!field) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 })
  }

  const snapshot = await getAdminDb().collection("sellerApplications").doc(uid).get()
  const path = snapshot.data()?.kyc?.[field]
  if (!path) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }

  const [url] = await getAdminStorage()
    .bucket()
    .file(path)
    .getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000 })

  return NextResponse.json({ url })
}
