"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { loginWithGoogle } from "@/services/auth.service"
import { ensureUserProfile } from "@/services/user.service"
import { isAdminRole } from "@/lib/admin-roles"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/google-icon"

export default function SignupPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  async function submit() {
    try {
      setLoading(true)

      const user = await loginWithGoogle()
      const profile = await ensureUserProfile(
        user.uid,
        user.displayName || user.email?.split("@")[0] || "",
        user.email || "",
      )

      alert("Account Created Successfully!")

      // A newly-invited staff member's very first Google sign-in can land
      // here too — send them to the admin panel, not the buyer profile.
      router.push(isAdminRole(profile.role) ? "/admin" : "/profile")
    } catch (error: any) {
      if (error?.code !== "auth/popup-closed-by-user") alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:py-24">
      <header className="text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Create Account
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Join YashWorld for early access and saved favorites.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <Button
          type="button"
          size="lg"
          className="h-11 w-full gap-3"
          disabled={loading}
          onClick={submit}
        >
          <GoogleIcon className="size-5" />
          {loading ? "Creating Account..." : "Sign up with Google"}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign In
        </Link>
      </p>
    </div>
  )
}