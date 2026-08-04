/**
 * One-time migration: rewrites every orders/{id} document's top-level
 * `status` and each `sellerOrders[].status` from the old 18-value
 * OrderStatus enum to the new 11-value one (types/order-lifecycle.ts).
 *
 * Standalone — never imported by the app. Uses firebase-admin directly
 * (same env vars as lib/firebase-admin.ts), which a plain `tsx` process
 * doesn't get from Next's auto .env.local loading — source it first:
 *
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/migrate-order-status-enum.ts                              # dry run — writes nothing
 *   npx tsx scripts/migrate-order-status-enum.ts --execute --project yash-world   # actually writes
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const STATUS_MAP: Record<string, string> = {
  Pending: "Pending",
  Accepted: "Accepted",
  Packing: "Ready To Pack",
  "Ready To Ship": "Packed",
  Shipped: "In Transit",
  "Out For Delivery": "Out For Delivery",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
  "Return Requested": "Returned",
  "Return Approved": "Returned",
  "Return Rejected": "Delivered",
  "Pickup Scheduled": "Pickup Requested",
  "Picked Up": "Picked Up",
  Refunded: "Returned",
  "Replacement Requested": "Returned",
  "Replacement Approved": "Returned",
  "Replacement Rejected": "Delivered",
  Completed: "Delivered",
  // Already-current values (idempotent re-run safety):
  "Ready To Pack": "Ready To Pack",
  Packed: "Packed",
  "Pickup Requested": "Pickup Requested",
  "In Transit": "In Transit",
  Returned: "Returned",
}

function parseArgs() {
  const args = process.argv.slice(2)
  const execute = args.includes("--execute")
  const projectFlagIndex = args.indexOf("--project")
  const project = projectFlagIndex !== -1 ? args[projectFlagIndex + 1] : undefined
  return { execute, project }
}

async function main() {
  const { execute, project } = parseArgs()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.")
    console.error("Run: set -a && source .env.local && set +a")
    process.exit(1)
  }

  if (execute && project !== projectId) {
    console.error(
      `--execute requires --project ${projectId} (the project your credentials point at) as an explicit confirmation. ` +
        `Got: ${project ?? "(none)"}`,
    )
    process.exit(1)
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const db = getFirestore()

  console.log(`Project: ${projectId}`)
  console.log(execute ? "Mode: EXECUTE (writes will be made)" : "Mode: DRY RUN (no writes will be made)")
  console.log("")

  const snap = await db.collection("orders").get()
  const batch = db.batch()
  let ordersChanged = 0

  for (const doc of snap.docs) {
    const data = doc.data() as { status?: string; sellerOrders?: { sellerId: string; status?: string }[] }
    let changed = false

    const newTopStatus = data.status ? STATUS_MAP[data.status] : undefined
    if (data.status && newTopStatus && newTopStatus !== data.status) {
      console.log(`orders/${doc.id}  top status  ${data.status} -> ${newTopStatus}`)
      changed = true
    } else if (data.status && !newTopStatus) {
      console.warn(`orders/${doc.id}  top status "${data.status}" has no mapping — leaving as-is, check manually.`)
    }

    const newSellerOrders = (data.sellerOrders ?? []).map((so) => {
      const mapped = so.status ? STATUS_MAP[so.status] : undefined
      if (so.status && mapped && mapped !== so.status) {
        console.log(`orders/${doc.id}  sellerOrder[${so.sellerId}]  ${so.status} -> ${mapped}`)
        changed = true
        return { ...so, status: mapped }
      }
      if (so.status && !mapped) {
        console.warn(`orders/${doc.id}  sellerOrder[${so.sellerId}] status "${so.status}" has no mapping — leaving as-is.`)
      }
      return so
    })

    if (changed) {
      ordersChanged++
      if (execute) {
        batch.update(doc.ref, {
          ...(newTopStatus && newTopStatus !== data.status ? { status: newTopStatus } : {}),
          sellerOrders: newSellerOrders,
        })
      }
    }
  }

  if (execute && ordersChanged > 0) await batch.commit()

  console.log("")
  console.log(`orders docs ${execute ? "updated" : "that would be updated"}: ${ordersChanged}`)
  if (!execute) {
    console.log("")
    console.log(`Dry run only — re-run with --execute --project ${projectId} to apply.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
