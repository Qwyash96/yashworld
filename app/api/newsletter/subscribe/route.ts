import { NextResponse, type NextRequest } from "next/server"
import { getAdminDb } from "@/lib/firebase-admin"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Public, unauthenticated — anyone can subscribe to the newsletter from the
 * footer. Doc ID is the lowercased email, so a re-subscribe is naturally
 * idempotent and detectable via exists() with no query needed. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const ref = getAdminDb().collection("newsletterSubscribers").doc(email)
  const existing = await ref.get()
  if (existing.exists) {
    return NextResponse.json({ alreadySubscribed: true })
  }

  await ref.set({ email, subscribedAt: new Date().toISOString() })
  return NextResponse.json({ alreadySubscribed: false })
}
