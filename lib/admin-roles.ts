import type { UserRole } from "@/types/user"

export type AdminRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "catalog_manager"
  | "support"
  | "finance"
  | "marketing"

export const ADMIN_ROLES: AdminRole[] = [
  "super_admin",
  "admin",
  "operations",
  "catalog_manager",
  "support",
  "finance",
  "marketing",
]

export function isAdminRole(role: UserRole | string | undefined | null): role is AdminRole {
  return !!role && (ADMIN_ROLES as string[]).includes(role)
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operations: "Operations",
  catalog_manager: "Catalog Manager",
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
 * can see. `admin` is a broad, non-super_admin elevated role — every
 * permission except admin_management/settings/security, which stay
 * super_admin-exclusive (staff management, platform-wide settings, and
 * security/audit are deliberately reserved). `operations` merges what used
 * to be two separate roles (orders_manager + seller_manager) since order
 * fulfilment and seller oversight are commonly one job in practice.
 * `catalog_manager` is a rename of the old products_manager — same scope.
 */
export const ROLE_PERMISSIONS: Record<Exclude<AdminRole, "super_admin">, AdminPermission[]> = {
  admin: [
    "user_management",
    "seller_management",
    "product_management",
    "order_management",
    "payments",
    "reviews",
    "coupons_offers",
    "reports_analytics",
    "marketing",
    "website_management",
    "support",
  ],
  operations: ["order_management", "seller_management"], // Orders, Shipping, Returns, Seller KYC, Approve/Reject Sellers
  catalog_manager: ["product_management"], // Products, Categories, Inventory
  support: ["support"], // Customer Tickets, Complaints
  finance: ["payments", "reports_analytics"], // Payments, Refunds, Reports
  marketing: ["coupons_offers", "marketing"], // Coupons, Banners, Campaigns
}

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  if (role === "super_admin") return true
  return ROLE_PERMISSIONS[role].includes(permission)
}
