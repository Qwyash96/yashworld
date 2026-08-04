import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { upsertInvite, listPendingInvites } from "@/lib/staff-invites"
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles"
import type { UserProfile } from "@/types/user"

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snapshot = await getAdminDb().collection("users").where("role", "in", ADMIN_ROLES).get()
  const staff = snapshot.docs.map((doc) => doc.data() as UserProfile)
  const invites = await listPendingInvites()

  return NextResponse.json({ staff, invites })
}

/**
 * "Invite" a staff member by Gmail — no password, Google Login only. If an
 * account already exists for this email (they've signed in before, even as
 * a buyer), promote it immediately. Otherwise record a pending invite that
 * app/api/auth/bootstrap-profile consumes on their first Google sign-in.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { email, mobile, department, role } = body as {
    email?: string
    mobile?: string
    department?: string
    role?: AdminRole
  }

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }
  if (!role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }

  const trimmedEmail = email.trim()

  try {
    const existingAuthUser = await getAdminAuth()
      .getUserByEmail(trimmedEmail)
      .catch(() => null)

    if (existingAuthUser) {
      const db = getAdminDb()
      const docRef = db.collection("users").doc(existingAuthUser.uid)
      const existingProfile = (await docRef.get()).data() as UserProfile | undefined

      const profile: UserProfile = {
        uid: existingAuthUser.uid,
        name: existingProfile?.name || existingAuthUser.displayName || trimmedEmail.split("@")[0],
        email: trimmedEmail,
        role,
        addresses: existingProfile?.addresses ?? [],
        createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
        status: "active",
        ...(mobile?.trim() ? { mobile: mobile.trim() } : {}),
        ...(department?.trim() ? { department: department.trim() } : {}),
      }
      await docRef.set(profile, { merge: true })

      return NextResponse.json({ status: "activated", staff: profile }, { status: 200 })
    }

    const invite = await upsertInvite({ email: trimmedEmail, role, mobile, department, invitedBy: auth.uid })
    return NextResponse.json({ status: "invited", invite }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Could not invite this staff member." }, { status: 500 })
  }
}
