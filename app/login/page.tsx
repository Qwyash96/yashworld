"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { loginWithEmail } from "@/services/auth.service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      alert("Email aur Password bharo")
      return
    }

    try {
      setLoading(true)

      await loginWithEmail(email.trim(), password)

      alert("Login Successful!")

      router.push("/profile")
    } catch (error: any) {
      alert(error.message)
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

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>

          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot?
            </button>
          </div>

          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full"
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In"}
        </Button>
      </form>

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