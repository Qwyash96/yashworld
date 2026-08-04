/**
 * Standalone (never imported by the app) — asserts hasPermission()/
 * getVisibleAdminSections()/getPermissionForPath() agree for every real
 * route and every role, for the full 7-role taxonomy built in this pass.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/verify-rbac-matrix.ts
 */
import { adminSections, getPermissionForPath, getVisibleAdminSections } from "@/components/admin/admin-sidebar"
import { ADMIN_ROLES, ROLE_PERMISSIONS, hasPermission, type AdminRole, type AdminPermission } from "@/lib/admin-roles"

let pass = 0
let fail = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++
    console.log(`  OK  ${msg}`)
  } else {
    fail++
    console.error(`FAIL  ${msg}`)
  }
}

console.log("=== Dashboard root is open to every role ===")
assert(getPermissionForPath("/admin") === null, `"/admin" requires no permission`)
assert(getPermissionForPath("/admin/notifications") === null, `"/admin/notifications" requires no permission`)

console.log("\n=== Every route the sidebar shows a role, the route guard also allows ===")
for (const role of ADMIN_ROLES) {
  const sections = role === "super_admin" ? adminSections : getVisibleAdminSections(role)
  const hrefs = sections
    .flatMap((s) => s.items)
    .filter((item) => item.href !== "#" && (!item.superAdminOnly || role === "super_admin"))
    .map((item) => item.href)

  for (const href of hrefs) {
    const path = href.split(/[#?]/)[0]!
    const required = getPermissionForPath(path)
    const allowed = required === null || role === "super_admin" || hasPermission(role, required as AdminPermission)
    assert(allowed, `${role}: sidebar shows "${href}" (requires "${required}") -> route guard allows it`)
  }
}

console.log("\n=== Role -> ROLE_PERMISSIONS sanity ===")
assert(ROLE_PERMISSIONS.admin.includes("user_management"), "admin holds user_management")
assert(!ROLE_PERMISSIONS.admin.includes("admin_management"), "admin does NOT hold admin_management")
assert(!ROLE_PERMISSIONS.admin.includes("settings"), "admin does NOT hold settings")
assert(!ROLE_PERMISSIONS.admin.includes("security"), "admin does NOT hold security")
assert(
  ROLE_PERMISSIONS.operations.includes("order_management") && ROLE_PERMISSIONS.operations.includes("seller_management"),
  "operations holds both order_management and seller_management (merged from the old 2 roles)",
)
assert(ROLE_PERMISSIONS.catalog_manager.includes("product_management"), "catalog_manager holds product_management")
const OLD_ROLE_NAMES = new Set(["orders_manager", "products_manager", "seller_manager"])
assert(
  Object.keys(ROLE_PERMISSIONS).every((r) => !OLD_ROLE_NAMES.has(r)),
  "no old role names remain in ROLE_PERMISSIONS",
)

console.log("\n=== New modules reachable by the roles the plan assigned them to ===")
const checks: [string, AdminPermission, AdminRole][] = [
  ["/admin/users", "user_management", "admin"],
  ["/admin/orders", "order_management", "operations"],
  ["/admin/reports/sales", "reports_analytics", "finance"],
  ["/admin/audit-logs", "security", "super_admin"],
  ["/admin/settings/general", "settings", "super_admin"],
]
for (const [path, expectedPermission, role] of checks) {
  const required = getPermissionForPath(path)
  assert(required === expectedPermission, `${path} requires "${expectedPermission}" (got "${required}")`)
  assert(hasPermission(role, expectedPermission), `${role} holds "${expectedPermission}" -> can open ${path}`)
}

console.log("\n=== Dynamic sub-routes inherit their list page's permission ===")
assert(getPermissionForPath("/admin/users/abc123") === "user_management", "/admin/users/[uid] requires user_management")
assert(getPermissionForPath("/admin/orders/abc123") === "order_management", "/admin/orders/[id] requires order_management")
assert(getPermissionForPath("/admin/sellers/abc123") === "seller_management", "/admin/sellers/[id] requires seller_management")

console.log("\n=== Unregistered future paths still default to super_admin-only (secure default preserved) ===")
assert(getPermissionForPath("/admin/some-brand-new-page") === undefined, "an unmapped path returns undefined (caller treats as admin_management)")

console.log("\n=== Finance's payments hub: the 6 payment-gateway pages + Payouts/Refunds/Settlements are all reachable via \"payments\" ===")
const financePaymentPaths = [
  "/admin/integrations/razorpay",
  "/admin/integrations/cashfree",
  "/admin/integrations/phonepe",
  "/admin/integrations/payu",
  "/admin/integrations/stripe",
  "/admin/integrations/paypal",
  "/admin/payouts",
  "/admin/refunds",
  "/admin/settlements",
]
for (const path of financePaymentPaths) {
  const required = getPermissionForPath(path)
  assert(required === "payments", `${path} requires "payments" (got "${required}")`)
  assert(hasPermission("finance", "payments"), `finance holds "payments" -> can open ${path}`)
}

console.log("\n=== Every other integration provider stays settings-only (super_admin), not leaked via the payments override ===")
const nonPaymentIntegrationPaths = [
  "/admin/integrations",
  "/admin/integrations/shiprocket",
  "/admin/integrations/delhivery",
  "/admin/integrations/gokwik",
  "/admin/integrations/meta_whatsapp",
  "/admin/integrations/google_analytics",
]
for (const path of nonPaymentIntegrationPaths) {
  const required = getPermissionForPath(path)
  assert(required === "settings", `${path} requires "settings" (got "${required}")`)
  assert(!hasPermission("finance", "settings"), `finance does NOT hold "settings" -> cannot open ${path}`)
}

console.log("\n=== finance/marketing/support/catalog_manager are correctly narrow ===")
assert(!hasPermission("finance", "order_management"), "finance cannot manage orders")
assert(!hasPermission("marketing", "user_management"), "marketing cannot manage users")
assert(!hasPermission("support", "payments"), "support cannot manage payments")
assert(!hasPermission("catalog_manager", "seller_management"), "catalog_manager cannot manage sellers")

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
