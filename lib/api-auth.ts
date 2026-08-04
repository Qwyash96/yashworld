import "server-only"
import type { NextRequest } from "next/server"
import { getAdminAuth } from "@/lib/firebase-admin"

type AuthResult = { ok: true; uid: string } | { ok: false; status: number; error: string }

/**
 * Verifies the caller's Firebase ID token and returns their uid — no role
 * check. For buyer-facing routes (checkout/payments) that only need "is this
 * a signed-in user," as opposed to lib/admin-api-auth.ts's admin-permission
 * checks.
 */
export async function requireSignedInUser(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization")
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!idToken) {
    return { ok: false, status: 401, error: "Missing authorization token." }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    return { ok: true, uid: decoded.uid }
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session." }
  }
}
