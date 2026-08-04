const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SubscribeResult =
  | { ok: true; alreadySubscribed: boolean }
  | { ok: false; error: string }

/** Validates client-side first (fast feedback), then calls the public
 * subscribe route, which re-validates and writes to Firestore server-side. */
export async function subscribeToNewsletter(email: string): Promise<SubscribeResult> {
  const trimmed = email.trim()
  if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." }
  }

  try {
    const response = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: body.error ?? "Failed to subscribe." }
    }
    return { ok: true, alreadySubscribed: !!body.alreadySubscribed }
  } catch {
    return { ok: false, error: "Could not reach the server. Please try again." }
  }
}
