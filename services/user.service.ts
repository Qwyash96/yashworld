import { doc, getDoc, updateDoc } from "firebase/firestore"
import { auth, db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Address, UserProfile, UserProfileInput } from "@/types/user"

const COLLECTION = "users"

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, uid))
    if (!snapshot.exists()) return null
    return snapshot.data() as UserProfile
  } catch (error) {
    throw toServiceError(`Failed to fetch user profile "${uid}"`, error)
  }
}

/**
 * Returns the caller's users/{uid} profile, creating one on first sign-in if
 * it doesn't exist yet. The actual creation happens server-side (Admin SDK)
 * via /api/auth/bootstrap-profile — Firestore rules deny client-side
 * `create` on users/{uid} entirely, so nobody can self-assign a role by
 * writing their own profile. That route checks for a pending staff invite
 * matching the signed-in email and assigns that role; otherwise defaults to
 * "buyer" (a seller is a buyer whose /sell/register application was later
 * approved — that flow promotes the role separately).
 */
export async function ensureUserProfile(uid: string, _name: string, _email: string): Promise<UserProfile> {
  const existing = await getUserProfile(uid)
  if (existing) return existing

  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const response = await fetch("/api/auth/bootstrap-profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to set up your account.")
  }
  const { profile } = (await response.json()) as { profile: UserProfile }
  return profile
}

export async function updateUserProfile(
  uid: string,
  input: Partial<Omit<UserProfileInput, "uid">>,
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, uid), { ...input })
  } catch (error) {
    throw toServiceError(`Failed to update user profile "${uid}"`, error)
  }
}

export async function updateUserAddresses(uid: string, addresses: Address[]): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, uid), { addresses })
  } catch (error) {
    throw toServiceError(`Failed to update addresses for "${uid}"`, error)
  }
}
