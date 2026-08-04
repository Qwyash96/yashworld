import { NextResponse, type NextRequest } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { getInvite, consumeInvite } from "@/lib/staff-invites"
import type { UserProfile } from "@/types/user"

/**
 * Called once right after any Google sign-in (buyer, seller, or staff). Uses
 * only the caller's own verified token — never a client-supplied uid/email —
 * so this can't be used to create a profile for someone else.
 *
 * If a users/{uid} profile already exists, returns it unchanged. Otherwise:
 * checks staffInvites/{verified email} for a pending role assignment (set by
 * a Super Admin via /admin/staff) and consumes it if found; if there's no
 * invite, this is a first-time buyer and gets role: "buyer" — the same
 * default as before, just server-side now instead of a client Firestore
 * write, so nobody can self-assign a role by writing their own profile.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!idToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 })
  }

  let uid: string
  let email: string | undefined
  let name: string | undefined
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    uid = decoded.uid
    email = decoded.email
    name = decoded.name
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ error: "Google account has no email address." }, { status: 400 })
  }

  const db = getAdminDb()
  const docRef = db.collection("users").doc(uid)
  const existing = await docRef.get()
  if (existing.exists) {
    return NextResponse.json({ profile: existing.data() as UserProfile })
  }

  const invite = await getInvite(email)
  const displayName = name || email.split("@")[0]

  const profile: UserProfile = invite
    ? {
        uid,
        name: displayName,
        email,
        role: invite.role,
        addresses: [],
        createdAt: new Date().toISOString(),
        status: "active",
        ...(invite.mobile ? { mobile: invite.mobile } : {}),
        ...(invite.department ? { department: invite.department } : {}),
      }
    : {
        uid,
        name: displayName,
        email,
        role: "buyer",
        addresses: [],
        createdAt: new Date().toISOString(),
      }

  await docRef.set(profile)
  if (invite) await consumeInvite(email, uid)

  return NextResponse.json({ profile })
}
