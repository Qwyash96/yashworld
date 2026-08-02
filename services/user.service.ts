import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/services/firebase/client"
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

export async function createUserProfile(input: UserProfileInput): Promise<void> {
  try {
    await setDoc(doc(db, COLLECTION, input.uid), {
      ...input,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    throw toServiceError(`Failed to create user profile "${input.uid}"`, error)
  }
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
