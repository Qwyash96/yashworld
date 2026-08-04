import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
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
