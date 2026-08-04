import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-api-auth"
import { getInvite, upsertInvite, deleteInvite } from "@/lib/staff-invites"
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles"

type RouteContext = { params: Promise<{ email: string }> }

/** Edits a pending invite's role/mobile/department before the invited Gmail has ever signed in. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { email } = await params
  const existing = await getInvite(email)
  if (!existing || existing.status !== "pending") {
    return NextResponse.json({ error: "No pending invite found for this email." }, { status: 404 })
  }

  const body = await request.json()
  const { role, mobile, department } = body as { role?: AdminRole; mobile?: string; department?: string }
  if (role && !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }

  const updated = await upsertInvite({
    email,
    role: role ?? existing.role,
    mobile: mobile ?? existing.mobile,
    department: department ?? existing.department,
    invitedBy: auth.uid,
  })

  return NextResponse.json({ invite: updated })
}

/** Cancels/revokes a pending invite — the email simply signs in as a buyer if they ever do. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { email } = await params
  const existing = await getInvite(email)
  if (!existing) {
    return NextResponse.json({ error: "No invite found for this email." }, { status: 404 })
  }

  await deleteInvite(email)
  return NextResponse.json({ ok: true })
}
