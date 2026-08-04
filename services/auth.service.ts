import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth"
import { auth } from "@/services/firebase/client"

const googleProvider = new GoogleAuthProvider()

export async function loginWithGoogle(remember: boolean = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  const credential = await signInWithPopup(auth, googleProvider)
  return credential.user
}

export async function logoutUser() {
  await signOut(auth)
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback)
}

/** Mirrors a newly-uploaded profile photo onto the Firebase Auth user's own
 * photoURL — this is what store-provider's auth listener reads, so the
 * header avatar updates immediately without a separate Firestore fetch. */
export async function updateAuthPhoto(photoUrl: string): Promise<void> {
  if (!auth.currentUser) return
  await updateProfile(auth.currentUser, { photoURL: photoUrl })
}
