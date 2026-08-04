import "server-only"
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

function getAdminApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]!

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin SDK credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    )
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket })
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}

export function getAdminStorage() {
  return getStorage(getAdminApp())
}
