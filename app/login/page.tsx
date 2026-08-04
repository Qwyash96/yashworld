"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { loginWithGoogle } from "@/services/auth.service"
import { ensureUserProfile } from "@/services/user.service"
import { isAdminRole } from "@/lib/admin-roles"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/google-icon"

export default function LoginPage() {
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

      alert("Login Successful!")

      // Staff/super_admin signing in through the normal Google button still
      // land in the admin panel, not the buyer profile page — this is the
      // one and only place that decision gets made, right after the role is
      // actually known.
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
          Sign In
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Welcome back to YashWorld.
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
          {loading ? "Signing In..." : "Sign in with Google"}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to YashWorld?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}