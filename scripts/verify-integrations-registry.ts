/**
 * Standalone (never imported by the app) — statically verifies every
 * adapter registered in lib/integrations/registry.ts: unique id, non-empty
 * credentialFields, a valid category, and that verifyConnection/testAction/
 * handleWebhook are implemented consistently with what each adapter
 * declares it supports.
 *
 * Reads source text with readFileSync rather than importing the modules —
 * every file under lib/integrations/ starts with `import "server-only"`,
 * which throws immediately outside a Server Component (same constraint as
 * scripts/migrate-role-names.ts and scripts/verify-wallet-integrity.ts,
 * which use the same static-analysis approach for the same reason).
 *
 * Run: npx tsx scripts/verify-integrations-registry.ts
 */
import { readFileSync, readdirSync } from "fs"

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

const ADAPTERS_DIR = "lib/integrations/adapters"
const VALID_CATEGORIES = ["payment", "shipping", "checkout", "whatsapp", "email", "sms", "analytics"]

const registrySource = readFileSync("lib/integrations/registry.ts", "utf-8")
const arrayMatch = registrySource.match(/const ADAPTERS: IntegrationAdapter\[\] = \[([\s\S]*?)\]/)
assert(!!arrayMatch, "registry.ts declares an ADAPTERS array")
const registeredNames = (arrayMatch?.[1] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

console.log(`\n=== ${registeredNames.length} adapters registered ===`)
assert(registeredNames.length === 21, `expected 21 adapters, found ${registeredNames.length}`)

const files = readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith(".ts") && f !== "twilio-shared.ts")
assert(files.length === registeredNames.length, `one adapter file per registered adapter (${files.length} files, ${registeredNames.length} registered)`)

console.log("\n=== Every adapter file: unique id, valid category, non-empty credentialFields, consistent capability flags ===")
const seenIds = new Set<string>()
const categoryCounts: Record<string, number> = {}

for (const file of files) {
  const source = readFileSync(`${ADAPTERS_DIR}/${file}`, "utf-8")
  const id = source.match(/id:\s*"([^"]+)"/)?.[1]
  const category = source.match(/category:\s*"([^"]+)"/)?.[1]
  const hasCredentialFields = /credentialFields:\s*\[\s*\{/.test(source)
  const supportsWebhook = /supportsWebhook:\s*true/.test(source)
  const supportsTest = /supportsTest:\s*true/.test(source)

  assert(!!id, `${file} declares an id`)
  if (id) {
    assert(!seenIds.has(id), `"${id}" is not a duplicate id`)
    seenIds.add(id)
  }
  assert(!!category && VALID_CATEGORIES.includes(category), `${file} declares a valid category ("${category}")`)
  if (category) categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
  assert(hasCredentialFields, `${file} declares at least one credential field`)
  assert(/async verifyConnection/.test(source), `${file} implements verifyConnection`)
  if (supportsTest) assert(/async testAction/.test(source), `${file} declares supportsTest and implements testAction`)
  if (supportsWebhook) assert(/async handleWebhook/.test(source), `${file} declares supportsWebhook and implements handleWebhook`)
}

console.log("\n=== Category counts match the plan (Payment 6, Shipping 5, Checkout 1, WhatsApp 2, Email 3, SMS 2, Analytics 2) ===")
const EXPECTED_COUNTS: Record<string, number> = {
  payment: 6,
  shipping: 5,
  checkout: 1,
  whatsapp: 2,
  email: 3,
  sms: 2,
  analytics: 2,
}
for (const category of VALID_CATEGORIES) {
  assert((categoryCounts[category] ?? 0) === EXPECTED_COUNTS[category], `${category}: expected ${EXPECTED_COUNTS[category]}, found ${categoryCounts[category] ?? 0}`)
}

console.log("\n=== Razorpay (the one real, live-checkout provider) declares the fields the migration script writes ===")
const razorpaySource = readFileSync(`${ADAPTERS_DIR}/razorpay.ts`, "utf-8")
for (const key of ["keyId", "keySecret", "webhookSecret", "paymentLink"]) {
  assert(razorpaySource.includes(`key: "${key}"`), `razorpay.ts declares credential field "${key}"`)
}
for (const key of ["upi", "cards", "netbanking", "wallet", "emi", "cod", "razorpayEnabled", "codEnabled", "defaultMethod"]) {
  assert(razorpaySource.includes(`key: "${key}"`), `razorpay.ts declares setting field "${key}"`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
