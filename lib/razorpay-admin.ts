import "server-only"
import Razorpay from "razorpay"

/**
 * Server-only Razorpay Node SDK client, built from whatever credentials the
 * caller passes — always the ones currently saved in Firestore
 * (lib/payment-settings.ts's getPaymentSettings()), never env vars. A
 * super_admin can rotate keys from /admin/settings/payments without a
 * redeploy, so this can't cache a single instance keyed by nothing.
 */
export function getRazorpayClient(keyId: string, keySecret: string): Razorpay {
  if (!keyId || !keySecret) {
    throw new Error("Razorpay isn't configured yet — add a Key ID and Key Secret in Payment Settings.")
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}
