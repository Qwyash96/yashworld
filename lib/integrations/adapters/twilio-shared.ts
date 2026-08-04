import "server-only"
import type { VerifyResult } from "@/lib/integrations/types"

/** Shared by the Twilio WhatsApp and Twilio SMS adapters — same account, different channel/category. */
export async function verifyTwilioAccount(credentials: Record<string, string>): Promise<VerifyResult> {
  const { accountSid, authToken } = credentials
  if (!accountSid || !authToken) {
    return { ok: false, message: "Account SID and Auth Token are required.", health: "unknown" }
  }
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, message: body?.message ?? "Twilio rejected these credentials.", health: "down" }
    }
    return { ok: true, message: `Connected to Twilio account "${body.friendly_name ?? accountSid}".`, health: "healthy" }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to reach Twilio.", health: "down" }
  }
}

/** Twilio's documented request-signing algorithm: base64(HMAC-SHA1(authToken, url + sorted "key"+"value" pairs)). */
export async function validateTwilioSignature(authToken: string, url: string, params: URLSearchParams, signature: string): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("crypto")
  const sortedKeys = Array.from(params.keys()).sort()
  let data = url
  for (const key of sortedKeys) data += key + params.get(key)

  const computed = createHmac("sha1", authToken).update(data, "utf8").digest("base64")
  const a = Buffer.from(computed)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
