/** Firestore `siteSettings/social` — public URLs only, no secrets, so it's
 * openly readable by anyone (see firestore.rules). Writable only by
 * super_admin via app/api/admin/settings/social. */
export interface SocialLinks {
  instagram?: string
  whatsapp?: string
  facebook?: string
  youtube?: string
  updatedAt?: string
}

/** Firestore `siteSettings/branding` — the platform's own logo, shown in
 * the header/footer in place of the default Leaf-icon lockup once set.
 * Same public-read/super_admin-write shape as SocialLinks. */
export interface SiteBranding {
  logoUrl?: string
  updatedAt?: string
}
