import { Mail } from "lucide-react"
import { NewsletterSignup } from "@/components/newsletter-signup"

export function NewsletterSection() {
  return (
    <section className="bg-green-700 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Mail className="size-6 text-white" />
        <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">Get plant care tips & exclusive offers</h2>
        <p className="mt-1 text-xs text-green-100 sm:text-sm">Join our newsletter — no spam, unsubscribe any time.</p>
        <NewsletterSignup className="mt-4 w-full max-w-sm [&_input]:bg-white" />
      </div>
    </section>
  )
}
