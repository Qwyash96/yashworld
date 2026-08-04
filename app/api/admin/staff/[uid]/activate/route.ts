import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"

type RouteContext = { params: Promise<{ uid: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params

  await getAdminAuth().updateUser(uid, { disabled: false })
  await getAdminDb().collection("users").doc(uid).update({ status: "active" })

  return NextResponse.json({ ok: true })
}
