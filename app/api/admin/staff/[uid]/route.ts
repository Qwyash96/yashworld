import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles"
import type { Firestore } from "firebase-admin/firestore"

type RouteContext = { params: Promise<{ uid: string }> }

/** True if there is at most one *active* super_admin left in the system.
 * A suspended super_admin can't actually act, so they don't count as
 * "remaining" — otherwise suspending one super_admin would silently let the
 * other be demoted/deleted with no one left who can actually sign in. Used
 * to block demoting/deleting the last one — see the incident this guards
 * against: a super_admin PATCHing their own role away with no one left. */
async function isLastSuperAdmin(db: Firestore): Promise<boolean> {
  const superAdmins = await db.collection("users").where("role", "==", "super_admin").get()
  const active = superAdmins.docs.filter((doc) => doc.data().status !== "suspended")
  return active.length <= 1
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params
  const body = await request.json()
  const { fullName, email, mobile, department, role } = body as {
    fullName?: string
    email?: string
    mobile?: string
    department?: string
    role?: AdminRole
  }

  if (role && !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }

  const db = getAdminDb()
  const docRef = db.collection("users").doc(uid)
  const snapshot = await docRef.get()
  if (!snapshot.exists) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 })
  }

  // Never let the last super_admin be demoted away — this is exactly what
  // let a lone super_admin lock themselves out previously.
  if (role && role !== "super_admin" && snapshot.data()?.role === "super_admin") {
    if (await isLastSuperAdmin(db)) {
      return NextResponse.json(
        { error: "This is the last Super Admin — their role cannot be changed." },
        { status: 400 },
      )
    }
  }

  const authUpdate: { displayName?: string; email?: string } = {}
  if (fullName?.trim()) authUpdate.displayName = fullName.trim()
  if (email?.trim()) authUpdate.email = email.trim()
  if (Object.keys(authUpdate).length > 0) {
    await getAdminAuth().updateUser(uid, authUpdate)
  }

  const update: Record<string, string> = {}
  if (fullName?.trim()) update.name = fullName.trim()
  if (email?.trim()) update.email = email.trim()
  if (mobile?.trim()) update.mobile = mobile.trim()
  if (department?.trim()) update.department = department.trim()
  if (role) update.role = role

  await docRef.update(update)

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { uid } = await params

  if (uid === auth.uid) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 })
  }

  const db = getAdminDb()
  const docRef = db.collection("users").doc(uid)
  const snapshot = await docRef.get()
  if (!snapshot.exists) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 })
  }

  if (snapshot.data()?.role === "super_admin" && (await isLastSuperAdmin(db))) {
    return NextResponse.json({ error: "At least one Super Admin must remain." }, { status: 400 })
  }

  await getAdminAuth().deleteUser(uid)
  await docRef.delete()

  return NextResponse.json({ ok: true })
}
