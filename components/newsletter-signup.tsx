"use client"

import { useState } from "react"
import { toast } from "sonner"
import { subscribeToNewsletter } from "@/services/newsletter.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** The real, working newsletter signup (services/newsletter.service.ts) —
 * shared by the footer and the homepage's newsletter section so the two
 * never drift. */
export function NewsletterSignup({ className }: { className?: string }) {
  const [email, setEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || subscribing) return
    setSubscribing(true)
    const result = await subscribeToNewsletter(email)
    setSubscribing(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.alreadySubscribed) {
      toast.info("You're already subscribed.")
    } else {
      toast.success("Subscribed", { description: "You're on the list for plant care tips & offers." })
    }
    setEmail("")
  }

  return (
    <form onSubmit={subscribe} className={cn("flex max-w-sm gap-2", className)}>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        aria-label="Email address"
        className="h-11"
      />
      <Button type="submit" size="lg" className="h-11 shrink-0" disabled={subscribing}>
        {subscribing ? "Subscribing..." : "Subscribe"}
      </Button>
    </form>
  )
}
