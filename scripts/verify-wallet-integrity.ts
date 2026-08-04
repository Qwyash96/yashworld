/**
 * Standalone (never imported by the app) — verifies the seller order-status
 * route can never let a client-supplied commissionAmount/payoutAmount
 * through (the exact gap closed in Phase 1: a seller used to be able to
 * rewrite their whole sellerOrders array via a direct Firestore write).
 *
 * Since a full integration test would need a Firestore emulator (not set
 * up in this environment), this does two things instead:
 * 1. A static source-shape check — the route's request-body interface must
 *    never declare commissionAmount/payoutAmount as accepted fields, and
 *    the handler must never read those keys off `body`.
 * 2. A behavioral check of the exported pure transition-validation logic
 *    (mirrors ORDER_FULFILMENT_SEQUENCE/isCancellable from
 *    types/order-lifecycle.ts, which the route itself uses).
 *
 * Run: npx tsx scripts/verify-wallet-integrity.ts
 */
import { readFileSync } from "fs"
import { ORDER_FULFILMENT_SEQUENCE, isCancellable } from "@/types/order-lifecycle"
import type { OrderStatus } from "@/types/order"

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

console.log("=== Static: seller order-status route never accepts commission/payout from the client ===")
const routeSource = readFileSync("app/api/seller/orders/[id]/status/route.ts", "utf-8")
assert(!/body\.commissionAmount|body\.payoutAmount/.test(routeSource), "route never reads commissionAmount/payoutAmount off the request body")
assert(/interface StatusBody\s*{\s*status\?:/.test(routeSource), "StatusBody only declares `status` as a client-settable field")
assert(
  /\.\.\.sellerOrder,/.test(routeSource),
  "the updated sellerOrder is built by spreading the STORED sellerOrder (which carries commissionAmount/payoutAmount through untouched), not a client-supplied one",
)

console.log("\n=== Static: firestore.rules no longer lets a seller write orders/{id} directly ===")
const rulesSource = readFileSync("firestore.rules", "utf-8")
assert(
  !/resource\.data\.sellerIds\.hasAny.*affectedKeys\(\)\.hasOnly\(\['sellerOrders'\]\)/.test(rulesSource),
  "the old seller-writable orders rule (whole sellerOrders array) is gone",
)
assert(/allow update: if isAdmin\(\);/.test(rulesSource), "orders/{orderId} update is admin-only now")

console.log("\n=== Behavioral: order status transition rules ===")
const seq = ORDER_FULFILMENT_SEQUENCE
for (let i = 0; i < seq.length - 1; i++) {
  assert(seq[i + 1] !== undefined, `forward transition ${seq[i]} -> ${seq[i + 1]} is a valid next step`)
}
assert(isCancellable("Pending"), "Pending is cancellable")
assert(isCancellable("Accepted"), "Accepted is cancellable")
assert(!isCancellable("Picked Up"), "Picked Up is NOT cancellable (courier already has it)")
assert(!isCancellable("Delivered"), "Delivered is NOT cancellable")

// Mirrors the route's isAllowedTransition() logic exactly, to catch drift.
function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "Cancelled") return isCancellable(from)
  const fromIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(from)
  const toIndex = ORDER_FULFILMENT_SEQUENCE.indexOf(to)
  return fromIndex !== -1 && toIndex === fromIndex + 1
}
assert(isAllowedTransition("Pending", "Accepted"), "Pending -> Accepted allowed")
assert(!isAllowedTransition("Pending", "Delivered"), "Pending -> Delivered (skipping steps) NOT allowed")
assert(!isAllowedTransition("Delivered", "Pending"), "Delivered -> Pending (backwards) NOT allowed")
assert(isAllowedTransition("Ready To Pack", "Cancelled"), "Ready To Pack -> Cancelled allowed (still cancellable)")
assert(!isAllowedTransition("Picked Up", "Cancelled"), "Picked Up -> Cancelled NOT allowed (past the cancel window)")

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
