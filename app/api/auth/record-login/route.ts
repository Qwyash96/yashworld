import { NextResponse, type NextRequest } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import type { LoginHistoryEntry } from "@/types/login-history"

/**
 * Called from services/user.service.ts's ensureUserProfile() on every
 * login, not just the first (unlike bootstrap-profile, which only creates
 * the profile once). Fire-and-forget from the caller — must never block or
 * fail a login.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!idToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 })
  }

  let uid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 })
  }

  const db = getAdminDb()
  const now = new Date().toISOString()
  const entry: Omit<LoginHistoryEntry, "id"> = {
    uid,
    at: now,
    method: "google",
    ...(request.headers.get("user-agent") ? { userAgent: request.headers.get("user-agent")! } : {}),
  }

  await Promise.all([
    db.collection("loginHistory").add(entry),
    db.collection("users").doc(uid).update({ lastLoginAt: now }),
  ])

  return NextResponse.json({ ok: true })
}
