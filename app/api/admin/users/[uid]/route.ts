import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import type { UserProfile } from "@/types/user"

type RouteContext = { params: Promise<{ uid: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "user_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const snap = await getAdminDb().collection("users").doc(uid).get()
  if (!snap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 })

  return NextResponse.json({ user: snap.data() as UserProfile })
}
