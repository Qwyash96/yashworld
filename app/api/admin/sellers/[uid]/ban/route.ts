import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { applyModerationAction } from "@/lib/seller-moderation"

type RouteContext = { params: Promise<{ uid: string }> }

/** Permanently locks a seller out — disables their Firebase Auth account in
 * addition to flagging both Firestore docs. Reversible only via /approve. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "seller_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const body = await request.json()
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""

  if (!reason) {
    return NextResponse.json({ error: "A ban reason is required." }, { status: 400 })
  }

  const result = await applyModerationAction(uid, "banned", reason, auth.uid, { email: auth.email, role: auth.role })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
