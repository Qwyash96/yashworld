"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Camera, MessageCircle, Play } from "lucide-react"
import { categories } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const footerNav = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Bag", href: "/cart" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Create Account", href: "/signup" },
      { label: "My Profile", href: "/profile" },
      { label: "Contact", href: "/contact" },
    ],
  },
]

export function SiteFooter() {
  const [email, setEmail] = useState("")

  function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    toast.success("Subscribed", { description: "You're on the list." })
    setEmail("")
  }

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
              YASHWORLD
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Premium monochrome essentials. Considered design, honest materials, and a
              wardrobe built to last.
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
              <Button type="submit" size="lg" className="h-10 shrink-0">
                Subscribe
              </Button>
            </form>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Categories
            </h3>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} YashWorld. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Instagram">
              <Camera className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Messenger">
              <MessageCircle className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="YouTube">
              <Play className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
