"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Camera, MessageCircle, ThumbsUp, Play } from "lucide-react"
import { getPublicSocialLinks } from "@/services/site-settings.service"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { BrandMark } from "@/components/brand-mark"
import type { SocialLinks } from "@/types/site-settings"
import { Button } from "@/components/ui/button"

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Become a Seller", href: "/sell" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
]

export function SiteFooter() {
  const [social, setSocial] = useState<SocialLinks>({})

  useEffect(() => {
    getPublicSocialLinks().then(setSocial)
  }, [])

  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandMark size="header" />
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#444444]">
              India&apos;s premium marketplace for plants, pots and gardening essentials.
            </p>
            <NewsletterSignup className="mt-4" />
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-black transition-colors hover:text-green-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <p className="text-xs text-[#444444]">
            © {new Date().getFullYear()} IXOFLORA. All rights reserved.
          </p>
          {(social.whatsapp || social.instagram || social.facebook || social.youtube) && (
            <div className="flex items-center gap-1">
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
              {social.facebook && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Facebook"
                  render={<a href={social.facebook} target="_blank" rel="noopener noreferrer" />}
                >
                  <ThumbsUp className="size-4 text-green-700" />
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
