import type { Order } from "@/types/order"

/**
 * The one user-facing order id shown everywhere — the sequential ORDnnnn
 * number (lib/sequential-id.ts) minted at checkout, or, for an order
 * created before that field existed, the previous truncated-Firestore-id
 * fallback. Never the raw Firestore document id on its own. Client-safe
 * (no "server-only") since every order list/detail page imports this.
 */
export function orderDisplayId(order: Pick<Order, "id" | "orderNumber">): string {
  return order.orderNumber ?? order.id.slice(0, 8)
}
