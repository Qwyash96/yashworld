import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { AdminRole } from "@/lib/admin-roles"
import type { StaffInvite } from "@/types/staff-invite"

const COLLECTION = "staffInvites"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getInvite(email: string): Promise<StaffInvite | null> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(normalizeEmail(email)).get()
  if (!snapshot.exists) return null
  return snapshot.data() as StaffInvite
}

/** Creates a new invite or updates an existing pending one (idempotent re-invite). */
export async function upsertInvite(input: {
  email: string
  role: AdminRole
  mobile?: string
  department?: string
  invitedBy: string
}): Promise<StaffInvite> {
  const email = normalizeEmail(input.email)
  const invite: StaffInvite = {
    email,
    role: input.role,
    ...(input.mobile?.trim() ? { mobile: input.mobile.trim() } : {}),
    ...(input.department?.trim() ? { department: input.department.trim() } : {}),
    invitedBy: input.invitedBy,
    invitedAt: new Date().toISOString(),
    status: "pending",
  }
  await getAdminDb().collection(COLLECTION).doc(email).set(invite)
  return invite
}

/** Marks a pending invite as consumed by the given uid — called on first login. */
export async function consumeInvite(email: string, uid: string): Promise<void> {
  await getAdminDb()
    .collection(COLLECTION)
    .doc(normalizeEmail(email))
    .update({ status: "consumed", consumedAt: new Date().toISOString(), consumedUid: uid })
}

export async function deleteInvite(email: string): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(normalizeEmail(email)).delete()
}

export async function listPendingInvites(): Promise<StaffInvite[]> {
  const snapshot = await getAdminDb().collection(COLLECTION).where("status", "==", "pending").get()
  return snapshot.docs.map((doc) => doc.data() as StaffInvite)
}
