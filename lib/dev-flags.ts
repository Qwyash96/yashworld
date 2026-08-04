/**
 * TEMPORARY — development only.
 *
 * When true, every logged-in user (any role, including buyer/seller) can see
 * and enter the Admin menu/panel on the frontend. This affects ONLY
 * client-side menu/page visibility in app/admin/** and components/admin/**.
 *
 * It does NOT touch:
 * - Backend permission checks (lib/admin-api-auth.ts's requireSuperAdmin /
 *   requireAdminPermission) — every /api/admin/** route still rejects
 *   unauthorized callers exactly as before.
 * - firestore.rules — Firestore access is unaffected.
 * - Seller KYC, Orders, Payments/Razorpay, Products, or the auth flow itself.
 *
 * So a buyer can now see the Admin sidebar and its pages, but any actual
 * mutation (save settings, approve a seller, invite staff, etc.) still 403s
 * server-side, same as always.
 *
 * To restore role-based Admin menu visibility, set this back to false (or
 * delete it and revert the `DEV_SHOW_ADMIN_MENU_TO_ALL ||` guards that
 * reference it in app/admin/layout.tsx, components/admin/admin-sidebar.tsx,
 * and app/admin/settings/payments/page.tsx).
 */
export const DEV_SHOW_ADMIN_MENU_TO_ALL = false
