import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

type RouteContext = { params: Promise<{ uid: string }> }

/** Bans a buyer — stronger than Suspend, same enforcement mechanism (status flag + Auth disable). */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "user_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  await Promise.all([
    getAdminDb().collection("users").doc(uid).update({ status: "banned" }),
    getAdminAuth().updateUser(uid, { disabled: true }),
  ])

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.ban",
    targetType: "user",
    targetId: uid,
    after: { status: "banned" },
  })

  return NextResponse.json({ ok: true })
}
