import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"

/**
 * The one fixed set of user-facing ID prefixes used across all of Ixoflora —
 * Order/Invoice/Refund/Return/Payment/Adjustment/Settlement. These are
 * NEVER a replacement for a Firestore document id (which stays exactly as
 * it is — `orders/{id}`, `financeAdjustments/{id}`, etc. — and is what
 * every internal read/write/query still keys on) or for any external
 * gateway/courier id (Razorpay `pay_...`/`order_...`, Shiprocket shipment
 * ids, Amazon Shipping/Ekart references, ...). This is purely the extra,
 * human-readable field stamped onto an entity once at creation time and
 * shown to buyers/sellers/admins instead of a raw Firestore id.
 */
export const SEQUENTIAL_ID_PREFIXES = {
  order: "ORD",
  invoice: "INV",
  refund: "REF",
  return: "RET",
  payment: "PAY",
  adjustment: "ADJ",
  settlement: "SET",
} as const

export type SequentialIdKind = keyof typeof SEQUENTIAL_ID_PREFIXES

function formatId(kind: SequentialIdKind, seq: number): string {
  return `${SEQUENTIAL_ID_PREFIXES[kind]}${String(seq).padStart(4, "0")}`
}

/**
 * Mints the next id for `kind` via a dedicated atomic counter document
 * (`idCounters/{prefix}`, one per entity type, never per-month/per-year —
 * a single global monotonically-increasing sequence) in its own
 * transaction. A number is only ever consumed by a real, committed entity;
 * if the caller's own subsequent write then fails for an unrelated reason,
 * that one number is simply skipped (a gap), never reassigned to a later
 * entity — gaps are normal in real invoice/order numbering, silent reuse
 * is not.
 *
 * Use this when the caller's own write isn't already inside an open
 * Firestore transaction (or when it's simpler/cheaper to accept the rare
 * skipped-number-on-failure tradeoff for an operation that fails
 * infrequently). For the one high-frequency exception — order creation,
 * which can legitimately fail via `DuplicatePaymentError` on ordinary
 * double-clicks/gateway retries — the counter is instead read and
 * committed inside `finalizeOrder`'s own transaction so a routine retry
 * never burns a number; see `lib/order-finalize.ts`.
 */
export async function mintSequentialId(kind: SequentialIdKind): Promise<string> {
  const db = getAdminDb()
  const counterRef = db.collection("idCounters").doc(SEQUENTIAL_ID_PREFIXES[kind])

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = ((snap.data()?.seq as number | undefined) ?? 0) + 1
    tx.set(counterRef, { seq: next }, { merge: true })
    return next
  })

  return formatId(kind, seq)
}

/**
 * Same counter, same format, but for a caller that already has an open
 * `Transaction` (e.g. `lib/order-finalize.ts`'s single checkout
 * transaction) and wants the mint to succeed or roll back atomically
 * together with its own write — no separately-committed counter
 * transaction, so a failure anywhere in the caller's transaction leaves
 * the counter completely untouched (not even a skipped number).
 *
 * Firestore transactions require every read to happen before any write, so
 * this only performs the read half — call it alongside the transaction's
 * other reads, then call the returned `commit()` any time after (order
 * relative to the caller's other writes doesn't matter).
 */
export async function readSequentialIdForTransaction(
  tx: FirebaseFirestore.Transaction,
  kind: SequentialIdKind,
): Promise<{ id: string; commit: () => void }> {
  const db = getAdminDb()
  const counterRef = db.collection("idCounters").doc(SEQUENTIAL_ID_PREFIXES[kind])
  const snap = await tx.get(counterRef)
  const next = ((snap.data()?.seq as number | undefined) ?? 0) + 1
  return {
    id: formatId(kind, next),
    commit: () => tx.set(counterRef, { seq: next }, { merge: true }),
  }
}
