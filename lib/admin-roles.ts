import type { UserRole } from "@/types/user"

export type AdminRole =
  | "super_admin"
  | "orders_manager"
  | "products_manager"
  | "seller_manager"
  | "support"
  | "finance"
  | "marketing"

export const ADMIN_ROLES: AdminRole[] = [
  "super_admin",
  "orders_manager",
  "products_manager",
  "seller_manager",
  "support",
  "finance",
  "marketing",
]

export function isAdminRole(role: UserRole | string | undefined | null): role is AdminRole {
  return !!role && (ADMIN_ROLES as string[]).includes(role)
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  orders_manager: "Orders Manager",
  products_manager: "Products Manager",
  seller_manager: "Seller Manager",
  support: "Support",
  finance: "Finance",
  marketing: "Marketing",
}

export type AdminPermission =
  | "user_management"
  | "seller_management"
  | "product_management"
  | "order_management"
  | "payments"
  | "reviews"
  | "coupons_offers"
  | "reports_analytics"
  | "marketing"
  | "website_management"
  | "security"
  | "settings"
  | "support"
  | "admin_management"

/**
 * Which sidebar sections (see components/admin/admin-sidebar.tsx) each role
 * can see. Permission slugs are unchanged from before this role taxonomy —
 * only the role→permission mapping did. This reuses existing sections rather
 * than inventing new ones: Products Management already has Categories/
 * Inventory items, Seller Management already has KYC/Approve-Reject, Payments
 * already has Refunds, etc.
 */
export const ROLE_PERMISSIONS: Record<Exclude<AdminRole, "super_admin">, AdminPermission[]> = {
  finance: ["payments", "reports_analytics"], // Payments, Refunds, Reports
  orders_manager: ["order_management"], // Orders, Shipping, Returns
  products_manager: ["product_management"], // Products, Categories, Inventory
  seller_manager: ["seller_management"], // Seller KYC, Approve/Reject Sellers, Seller Profiles
  support: ["support"], // Customer Tickets, Complaints
  marketing: ["coupons_offers", "marketing"], // Coupons, Banners, Campaigns
}

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  if (role === "super_admin") return true
  return ROLE_PERMISSIONS[role].includes(permission)
}
