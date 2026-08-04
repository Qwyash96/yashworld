import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

type RouteContext = { params: Promise<{ uid: string }> }

/** Reactivates a suspended or banned buyer — the "Unban"/"Unsuspend" action. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "user_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  await Promise.all([
    getAdminDb().collection("users").doc(uid).update({ status: "active" }),
    getAdminAuth().updateUser(uid, { disabled: false }),
  ])

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.activate",
    targetType: "user",
    targetId: uid,
    after: { status: "active" },
  })

  return NextResponse.json({ ok: true })
}
