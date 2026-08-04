import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"

type RouteContext = { params: Promise<{ uid: string }> }

/** Suspends a buyer — Firestore status flag AND a real Firebase Auth
 * disable, so this actually blocks sign-in rather than being cosmetic. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "user_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  await Promise.all([
    getAdminDb().collection("users").doc(uid).update({ status: "suspended" }),
    getAdminAuth().updateUser(uid, { disabled: true }),
  ])

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.suspend",
    targetType: "user",
    targetId: uid,
    after: { status: "suspended" },
  })

  return NextResponse.json({ ok: true })
}
