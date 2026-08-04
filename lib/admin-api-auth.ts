import "server-only"
import type { NextRequest } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { hasPermission, isAdminRole, type AdminPermission, type AdminRole } from "@/lib/admin-roles"

type AuthResult =
  | { ok: true; uid: string; role: AdminRole; email: string }
  | { ok: false; status: number; error: string }

/** Verifies the caller's Firebase ID token and returns their uid/email + users/{uid} role. */
async function verifyCaller(
  request: NextRequest,
): Promise<
  | { ok: true; uid: string; email: string; role: string | undefined }
  | { ok: false; status: number; error: string }
> {
  const authHeader = request.headers.get("authorization")
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!idToken) {
    return { ok: false, status: 401, error: "Missing authorization token." }
  }

  let uid: string
  let email: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    uid = decoded.uid
    email = decoded.email ?? ""
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session." }
  }

  const callerSnap = await getAdminDb().collection("users").doc(uid).get()
  return { ok: true, uid, email, role: callerSnap.data()?.role }
}

/** Verifies the caller's Firebase ID token and requires their users/{uid} role to be super_admin. */
export async function requireSuperAdmin(request: NextRequest): Promise<AuthResult> {
  const caller = await verifyCaller(request)
  if (!caller.ok) return caller

  if (caller.role !== "super_admin") {
    return { ok: false, status: 403, error: "Only Super Admin can perform this action." }
  }

  return { ok: true, uid: caller.uid, email: caller.email, role: "super_admin" }
}

/** Verifies the caller's Firebase ID token and requires their role to hold the given admin permission.
 * super_admin always passes, explicitly — not just because hasPermission short-circuits for it. */
export async function requireAdminPermission(request: NextRequest, permission: AdminPermission): Promise<AuthResult> {
  const caller = await verifyCaller(request)
  if (!caller.ok) return caller

  if (caller.role === "super_admin") {
    return { ok: true, uid: caller.uid, email: caller.email, role: "super_admin" }
  }

  if (!isAdminRole(caller.role) || !hasPermission(caller.role, permission)) {
    return { ok: false, status: 403, error: "You don't have permission to perform this action." }
  }

  return { ok: true, uid: caller.uid, email: caller.email, role: caller.role }
}

/** Verifies the caller's Firebase ID token and requires ANY admin role (no specific permission) —
 * used by routes like the dashboard/notifications, where the page itself decides what to show per role. */
export async function requireAnyAdmin(request: NextRequest): Promise<AuthResult> {
  const caller = await verifyCaller(request)
  if (!caller.ok) return caller

  if (!isAdminRole(caller.role)) {
    return { ok: false, status: 403, error: "Admin access required." }
  }

  return { ok: true, uid: caller.uid, email: caller.email, role: caller.role }
}
