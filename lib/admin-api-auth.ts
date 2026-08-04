import "server-only"
import type { NextRequest } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { hasPermission, isAdminRole, type AdminPermission } from "@/lib/admin-roles"

type AuthResult = { ok: true; uid: string } | { ok: false; status: number; error: string }

/** Verifies the caller's Firebase ID token and returns their uid + users/{uid} role. */
async function verifyCaller(
  request: NextRequest,
): Promise<{ ok: true; uid: string; role: string | undefined } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization")
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!idToken) {
    return { ok: false, status: 401, error: "Missing authorization token." }
  }

  let uid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session." }
  }

  const callerSnap = await getAdminDb().collection("users").doc(uid).get()
  return { ok: true, uid, role: callerSnap.data()?.role }
}

/** Verifies the caller's Firebase ID token and requires their users/{uid} role to be super_admin. */
export async function requireSuperAdmin(request: NextRequest): Promise<AuthResult> {
  const caller = await verifyCaller(request)
  if (!caller.ok) return caller

  if (caller.role !== "super_admin") {
    return { ok: false, status: 403, error: "Only Super Admin can perform this action." }
  }

  return { ok: true, uid: caller.uid }
}

/** Verifies the caller's Firebase ID token and requires their role to hold the given admin permission.
 * super_admin always passes, explicitly — not just because hasPermission short-circuits for it. */
export async function requireAdminPermission(request: NextRequest, permission: AdminPermission): Promise<AuthResult> {
  const caller = await verifyCaller(request)
  if (!caller.ok) return caller

  if (caller.role === "super_admin") {
    return { ok: true, uid: caller.uid }
  }

  if (!isAdminRole(caller.role) || !hasPermission(caller.role, permission)) {
    return { ok: false, status: 403, error: "You don't have permission to perform this action." }
  }

  return { ok: true, uid: caller.uid }
}
