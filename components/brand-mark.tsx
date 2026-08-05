"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Leaf } from "lucide-react"
import { getPublicSiteBranding } from "@/services/site-settings.service"
import { cn } from "@/lib/utils"

const BRAND_NAME = "IXOFLORA"

const SIZE = {
  // The header/footer/sidebar lockup — 28-32px on mobile, 40-44px on desktop.
  header: { box: "h-7 w-24 sm:h-8 sm:w-28 lg:h-10 lg:w-32 xl:h-11 xl:w-36", icon: "size-5 lg:size-7", text: "text-lg sm:text-xl lg:text-2xl" },
  // Centered hero lockup for auth-style pages (login/signup/seller register) — a bigger standalone brand moment.
  hero: { box: "h-9 w-32 sm:h-11 sm:w-40", icon: "size-7 sm:size-8", text: "text-2xl sm:text-3xl" },
} as const

/**
 * The one brand lockup used everywhere — header, footer, admin/seller
 * sidebars, and every auth-style page. Reads the real uploaded logo from
 * Firestore `siteSettings/branding` (Admin → Settings → Branding); falls
 * back to a Leaf icon + the site name until one's uploaded. Once a logo is
 * set there, every one of these call sites picks it up automatically — no
 * further code change needed.
 */
export function BrandMark({
  size = "header",
  href = "/",
  className,
  compact = false,
}: {
  size?: keyof typeof SIZE
  href?: string | null
  className?: string
  /** Hides the text label below `sm`, showing just the icon — for the
   * cramped top header row sitting next to a search bar. Irrelevant once a
   * real logo image is set (that always shows in full). */
  compact?: boolean
}) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    getPublicSiteBranding().then((b) => setLogoUrl(b.logoUrl))
  }, [])

  const s = SIZE[size]

  const content = logoUrl ? (
    <span className={cn("relative block shrink-0", s.box, className)}>
      <Image src={logoUrl} alt={BRAND_NAME} fill className="object-contain object-left" priority />
    </span>
  ) : (
    <span className={cn("flex items-center gap-1.5 font-bold text-green-700", s.text, className)}>
      <Leaf className={cn(s.icon, "shrink-0")} />
      <span className={compact ? "hidden sm:inline" : undefined}>{BRAND_NAME}</span>
    </span>
  )

  if (href === null) return content
  return (
    <Link href={href} className="flex shrink-0 items-center">
      {content}
    </Link>
  )
}
