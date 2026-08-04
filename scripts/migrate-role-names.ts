/**
 * One-time migration: renames the old AdminRole values (orders_manager,
 * products_manager, seller_manager) to the new ones (operations,
 * catalog_manager) across `users` and `staffInvites`, after the Phase-0 RBAC
 * restructuring in lib/admin-roles.ts.
 *
 * Standalone — never imported by the app. Uses firebase-admin directly
 * (same env vars as lib/firebase-admin.ts: FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY), which a plain `tsx` process
 * doesn't get from Next's auto .env.local loading — source it first:
 *
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/migrate-role-names.ts                              # dry run — writes nothing
 *   npx tsx scripts/migrate-role-names.ts --execute --project yash-world   # actually writes
 *
 * The --execute run refuses to proceed unless --project matches
 * FIREBASE_PROJECT_ID exactly, as a guard against running against the wrong
 * Firebase project by accident.
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const ROLE_MAP: Record<string, string> = {
  orders_manager: "operations",
  seller_manager: "operations",
  products_manager: "catalog_manager",
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

  let usersChanged = 0
  let invitesChanged = 0

  // --- users ---
  const usersSnap = await db.collection("users").get()
  const userBatch = db.batch()
  for (const doc of usersSnap.docs) {
    const role = doc.data().role as string | undefined
    if (!role || !(role in ROLE_MAP)) continue
    const newRole = ROLE_MAP[role]
    console.log(`users/${doc.id}  (${doc.data().email ?? "no email"})  ${role} -> ${newRole}`)
    if (execute) userBatch.update(doc.ref, { role: newRole })
    usersChanged++
  }
  if (execute && usersChanged > 0) await userBatch.commit()

  // --- staffInvites ---
  const invitesSnap = await db.collection("staffInvites").get()
  const inviteBatch = db.batch()
  for (const doc of invitesSnap.docs) {
    const role = doc.data().role as string | undefined
    if (!role || !(role in ROLE_MAP)) continue
    const newRole = ROLE_MAP[role]
    console.log(`staffInvites/${doc.id}  ${role} -> ${newRole}`)
    if (execute) inviteBatch.update(doc.ref, { role: newRole })
    invitesChanged++
  }
  if (execute && invitesChanged > 0) await inviteBatch.commit()

  console.log("")
  console.log(`users docs ${execute ? "updated" : "that would be updated"}: ${usersChanged}`)
  console.log(`staffInvites docs ${execute ? "updated" : "that would be updated"}: ${invitesChanged}`)
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
