"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { FirebaseError } from "firebase/app"
import { ShieldAlert } from "lucide-react"
import { loginWithGoogle, logoutUser } from "@/services/auth.service"
import { ensureUserProfile } from "@/services/user.service"
import { isAdminRole } from "@/lib/admin-roles"
import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/google-icon"

function humanizeAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return ""
      case "auth/popup-blocked":
        return "Your browser blocked the sign-in popup. Please allow popups and try again."
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later."
      default:
        return "Login failed. Please try again."
    }
  }
  return "Login failed. Please try again."
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setError("")
    setSubmitting(true)

    try {
      const firebaseUser = await loginWithGoogle(rememberMe)
      // Ensures a first-time sign-in lands its invited staff role (or
      // "buyer" if this Gmail was never invited) — without this, a brand
      // new staff member's first login would find no profile at all and be
      // denied, even though a Super Admin already assigned them a role.
      const profile = await ensureUserProfile(
        firebaseUser.uid,
        firebaseUser.displayName ?? "",
        firebaseUser.email ?? "",
      )

      if (!isAdminRole(profile.role)) {
        await logoutUser()
        setError("This account does not have admin access.")
        setSubmitting(false)
        return
      }

      router.push("/admin")
    } catch (err) {
      const message = humanizeAuthError(err)
      if (message) setError(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-[#f3f5f2] px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="text-3xl font-bold text-green-700">YashWorld</span>
          <div className="mt-4 flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-green-700">
            <ShieldAlert className="size-4" />
            Authorized Personnel Only
          </div>
          <h1 className="mt-6 text-2xl font-bold text-black">Admin Login</h1>
          <p className="mt-2 text-sm text-[#444444]">
            Sign in with your Google account to access the YashWorld admin panel.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-5">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <label className="flex items-center gap-2 text-sm text-black">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-border accent-green-700"
            />
            Remember me
          </label>

          <Button
            type="button"
            size="lg"
            className="mt-2 h-12 w-full gap-3 text-base"
            disabled={submitting}
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon className="size-5" />
            {submitting ? "Signing In..." : "Sign in with Google"}
          </Button>
        </div>
      </div>
    </div>
  )
}
