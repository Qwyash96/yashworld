/**
 * One-time migration: copies the checkout-method flags currently living on
 * integrations/razorpay.settings (upi/cards/netbanking/wallet/emi/cod) into
 * the new platformSettings/paymentMethods doc — see
 * types/platform-settings.ts's PaymentMethodsSettings doc comment for why
 * these are being pulled out of a specific gateway's settings. Plain
 * booleans, nothing to decrypt — much simpler than
 * migrate-payment-settings-to-integrations.ts, which handled real secrets.
 *
 * Does NOT touch integrations/razorpay itself — that's a separate code
 * change (removing the now-redundant settingFields from the adapter, done
 * alongside this in the same milestone) rather than a data migration.
 *
 * Standalone — never imported by the app.
 *
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/migrate-razorpay-methods-to-payment-settings.ts                                  # dry run — writes nothing
 *   npx tsx scripts/migrate-razorpay-methods-to-payment-settings.ts --execute --project yash-world    # actually writes
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function parseArgs() {
  const args = process.argv.slice(2)
  const execute = args.includes("--execute")
  const projectFlagIndex = args.indexOf("--project")
  const project = projectFlagIndex !== -1 ? args[projectFlagIndex + 1] : undefined
  return { execute, project }
}

interface RazorpaySettings {
  upi?: boolean
  cards?: boolean
  netbanking?: boolean
  wallet?: boolean
  emi?: boolean
  cod?: boolean
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

  const razorpaySnap = await db.collection("integrations").doc("razorpay").get()
  if (!razorpaySnap.exists) {
    console.log("integrations/razorpay does not exist — nothing to migrate.")
    return
  }
  const razorpaySettings = (razorpaySnap.data()?.settings ?? {}) as RazorpaySettings

  const paymentMethodsRef = db.collection("platformSettings").doc("paymentMethods")
  const existingSnap = await paymentMethodsRef.get()
  if (existingSnap.exists) {
    console.log("platformSettings/paymentMethods already exists — leaving it alone rather than overwriting an admin's real choices:")
    console.log(JSON.stringify(existingSnap.data(), null, 2))
    console.log("")
    console.log("Delete that doc first if you really want to re-run this migration.")
    return
  }

  const target = {
    methods: {
      upi: razorpaySettings.upi ?? false,
      cards: razorpaySettings.cards ?? false,
      netbanking: razorpaySettings.netbanking ?? false,
      wallet: razorpaySettings.wallet ?? false,
      emi: razorpaySettings.emi ?? false,
      cod: razorpaySettings.cod ?? true,
    },
    updatedAt: new Date().toISOString(),
  }

  console.log("platformSettings/paymentMethods <-", JSON.stringify(target, null, 2))

  if (execute) {
    await paymentMethodsRef.set(target, { merge: true })
    console.log("")
    console.log("Written to platformSettings/paymentMethods.")
  } else {
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
