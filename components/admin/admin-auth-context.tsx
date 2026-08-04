"use client"

import { createContext, useContext } from "react"
import type { UserRole } from "@/types/user"

export interface AdminProfile {
  uid: string
  name: string
  email: string
  // Widened from AdminRole to UserRole ONLY for the temporary
  // DEV_SHOW_ADMIN_MENU_TO_ALL bypass (lib/dev-flags.ts), which lets a
  // buyer/seller reach the admin shell. Once that flag is removed, this can
  // safely go back to AdminRole — every real caller will still only ever be
  // an admin role in practice.
  role: UserRole
}

export const AdminAuthContext = createContext<AdminProfile | null>(null)

/** The currently logged-in admin/staff member, resolved from Firebase Auth + Firestore. Only valid inside app/admin/layout.tsx's subtree. */
export function useAdminAuth(): AdminProfile {
  const admin = useContext(AdminAuthContext)
  if (!admin) throw new Error("useAdminAuth must be used within the /admin layout")
  return admin
}
