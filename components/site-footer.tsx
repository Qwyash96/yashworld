"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Camera, MessageCircle, Play, Leaf } from "lucide-react"
import { categories } from "@/lib/products"
import { subscribeToNewsletter } from "@/services/newsletter.service"
import { getPublicSocialLinks } from "@/services/site-settings.service"
import type { SocialLinks } from "@/types/site-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const footerNav = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Cart", href: "/cart" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Create Account", href: "/signup" },
      { label: "My Profile", href: "/profile" },
      { label: "My Orders", href: "/orders" },
      { label: "Become a Seller", href: "/sell" },
      { label: "Contact", href: "/contact" },
    ],
  },
]

export function SiteFooter() {
  const [email, setEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)
  const [social, setSocial] = useState<SocialLinks>({})

  useEffect(() => {
    getPublicSocialLinks().then(setSocial)
  }, [])

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
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-1.5 text-2xl font-bold text-green-700">
              <Leaf className="size-6" />
              YashWorld
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#444444]">
              India&apos;s premium marketplace for plants, pots and gardening essentials —
              sourced from verified sellers, delivered with care.
            </p>
            <form onSubmit={subscribe} className="mt-6 flex max-w-sm gap-2">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="h-10"
              />
              <Button type="submit" size="lg" className="h-10 shrink-0" disabled={subscribing}>
                {subscribing ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-black transition-colors hover:text-green-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
              Categories
            </h3>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="text-sm text-black transition-colors hover:text-green-700"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-[#444444]">
            © {new Date().getFullYear()} YashWorld. All rights reserved.
          </p>
          {(social.instagram || social.whatsapp || social.youtube) && (
            <div className="flex items-center gap-1">
              {social.instagram && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Instagram"
                  render={<a href={social.instagram} target="_blank" rel="noopener noreferrer" />}
                >
                  <Camera className="size-4 text-green-700" />
                </Button>
              )}
              {social.whatsapp && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="WhatsApp"
                  render={<a href={social.whatsapp} target="_blank" rel="noopener noreferrer" />}
                >
                  <MessageCircle className="size-4 text-green-700" />
                </Button>
              )}
              {social.youtube && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="YouTube"
                  render={<a href={social.youtube} target="_blank" rel="noopener noreferrer" />}
                >
                  <Play className="size-4 text-green-700" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
