/**
 * One-time migration: copies paymentSettings/config (the old, Razorpay-only
 * settings doc) into integrations/razorpay (the new Plug-and-Play
 * Integration System's generic config shape), encrypting keySecret/
 * webhookSecret/paymentLink with the same AES-256-GCM scheme
 * lib/integrations/crypto.ts uses at runtime.
 *
 * The encryption function is duplicated here rather than imported, and
 * Firebase Admin is initialized directly rather than via lib/firebase-admin.ts
 * — both of those files start with `import "server-only"`, which throws
 * immediately outside a Server Component (see scripts/migrate-role-names.ts
 * for the same constraint and the same workaround).
 *
 * Standalone — never imported by the app.
 *
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/migrate-payment-settings-to-integrations.ts                                  # dry run — writes nothing
 *   npx tsx scripts/migrate-payment-settings-to-integrations.ts --execute --project yash-world    # actually writes
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { createCipheriv, randomBytes } from "crypto"

function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":")
}

function parseArgs() {
  const args = process.argv.slice(2)
  const execute = args.includes("--execute")
  const projectFlagIndex = args.indexOf("--project")
  const project = projectFlagIndex !== -1 ? args[projectFlagIndex + 1] : undefined
  return { execute, project }
}

interface OldPaymentSettings {
  keyId?: string
  keySecret?: string
  webhookSecret?: string
  paymentLink?: string
  connected?: boolean
  lastVerifiedAt?: string
  methods?: Partial<Record<"upi" | "cards" | "netbanking" | "wallet" | "emi" | "cod", boolean>>
  checkout?: { razorpayEnabled?: boolean; codEnabled?: boolean; defaultMethod?: string }
}

async function main() {
  const { execute, project } = parseArgs()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  const encryptionKeyRaw = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.")
    console.error("Run: set -a && source .env.local && set +a")
    process.exit(1)
  }
  if (!encryptionKeyRaw) {
    console.error("Missing INTEGRATIONS_ENCRYPTION_KEY. Generate one with `openssl rand -base64 32` and add it to .env.local.")
    process.exit(1)
  }
  const encryptionKey = Buffer.from(encryptionKeyRaw, "base64")
  if (encryptionKey.length !== 32) {
    console.error("INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).")
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

  const snap = await db.collection("paymentSettings").doc("config").get()
  if (!snap.exists) {
    console.log("paymentSettings/config does not exist — nothing to migrate.")
    return
  }
  const settings = snap.data() as OldPaymentSettings

  // Every value in integrations/{id}.credentials is always AES-256-GCM
  // encrypted, uniformly — including keyId, which isn't secret on its own
  // but is decrypted unconditionally by lib/integrations/config-store.ts's
  // getDecryptedCredentials(), so it must be encrypted here too.
  const credentials: Record<string, string> = {}
  if (settings.keyId) credentials.keyId = encryptSecret(settings.keyId, encryptionKey)
  if (settings.keySecret) credentials.keySecret = encryptSecret(settings.keySecret, encryptionKey)
  if (settings.webhookSecret) credentials.webhookSecret = encryptSecret(settings.webhookSecret, encryptionKey)
  if (settings.paymentLink) credentials.paymentLink = encryptSecret(settings.paymentLink, encryptionKey)

  const target = {
    providerId: "razorpay",
    category: "payment",
    enabled: !!settings.checkout?.razorpayEnabled,
    environment: settings.keyId?.startsWith("rzp_live_") ? "live" : "sandbox",
    credentials,
    settings: {
      upi: settings.methods?.upi ?? false,
      cards: settings.methods?.cards ?? false,
      netbanking: settings.methods?.netbanking ?? false,
      wallet: settings.methods?.wallet ?? false,
      emi: settings.methods?.emi ?? false,
      cod: settings.methods?.cod ?? true,
      razorpayEnabled: settings.checkout?.razorpayEnabled ?? false,
      codEnabled: settings.checkout?.codEnabled ?? true,
      defaultMethod: settings.checkout?.defaultMethod ?? "cod",
    },
    connected: settings.connected ?? false,
    ...(settings.lastVerifiedAt ? { lastVerifiedAt: settings.lastVerifiedAt } : {}),
    health: settings.connected ? "healthy" : "unknown",
    isDefault: true,
    priority: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: "migration-script",
  }

  console.log(
    "integrations/razorpay <-",
    JSON.stringify(
      { ...target, credentials: Object.fromEntries(Object.keys(credentials).map((k) => [k, "<encrypted>"])) },
      null,
      2,
    ),
  )

  if (execute) {
    await db.collection("integrations").doc("razorpay").set(target, { merge: true })
    console.log("")
    console.log("Written to integrations/razorpay.")
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
