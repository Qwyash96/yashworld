/** Firestore `siteSettings/social` — public URLs only, no secrets, so it's
 * openly readable by anyone (see firestore.rules). Writable only by
 * super_admin via app/api/admin/settings/social. */
export interface SocialLinks {
  instagram?: string
  whatsapp?: string
  youtube?: string
  updatedAt?: string
}
