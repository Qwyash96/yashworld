import { deleteApp, getApps, initializeApp } from "firebase/app"
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth"
import { firebaseConfig } from "@/services/firebase/client"

const SECONDARY_APP_NAME = "phone-verify"

/**
 * Runs Firebase Phone Auth on an isolated, separately-named secondary app
 * instance instead of the primary `services/firebase/client.ts` app. This is
 * load-bearing: signing in with a phone credential on the PRIMARY app would
 * replace the seller's real (Google) session with a phone-auth session,
 * logging them out of their own account mid-KYC-form. The secondary app only
 * proves possession of the number; its session is discarded immediately
 * after `confirmOtp` succeeds.
 */
function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME)
  const app = existing ?? initializeApp(firebaseConfig, SECONDARY_APP_NAME)
  return getAuth(app)
}

/**
 * Sends an OTP to an Indian mobile number via Firebase Phone Auth.
 * `recaptchaContainerId` must be a DOM element id already mounted (an
 * invisible reCAPTCHA is attached to it). Throws the real Firebase error on
 * failure (invalid number, quota exceeded, etc.) — no simulated success.
 */
export async function sendOtp(mobile10Digit: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const secondaryAuth = getSecondaryAuth()
  const verifier = new RecaptchaVerifier(secondaryAuth, recaptchaContainerId, { size: "invisible" })
  try {
    return await signInWithPhoneNumber(secondaryAuth, `+91${mobile10Digit}`, verifier)
  } finally {
    verifier.clear()
  }
}

/** Confirms the OTP and immediately discards the secondary session — throws the real Firebase error on a wrong/expired code. */
export async function confirmOtp(confirmation: ConfirmationResult, code: string): Promise<void> {
  const secondaryAuth = getSecondaryAuth()
  await confirmation.confirm(code)
  await signOut(secondaryAuth)
  await deleteApp(secondaryAuth.app)
}
