import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"

type RouteContext = { params: Promise<{ uid: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  if (uid === auth.uid) {
    return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 })
  }

  await getAdminAuth().updateUser(uid, { disabled: true })
  await getAdminDb().collection("users").doc(uid).update({ status: "suspended" })

  return NextResponse.json({ ok: true })
}
