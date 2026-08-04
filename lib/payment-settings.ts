import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { PaymentSettings } from "@/types/payment-settings"

const COLLECTION = "paymentSettings"
const DOC_ID = "config"

/** Safe defaults for a fresh install — Razorpay off, COD on, so checkout never breaks. */
const DEFAULT_SETTINGS: PaymentSettings = {
  provider: "razorpay",
  mode: "test",
  keyId: "",
  keySecret: "",
  webhookSecret: "",
  connected: false,
  methods: { upi: false, cards: false, netbanking: false, wallet: false, emi: false, cod: true },
  checkout: { razorpayEnabled: false, codEnabled: true, defaultMethod: "cod", currency: "INR" },
  updatedAt: new Date(0).toISOString(),
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(DOC_ID).get()
  if (!snapshot.exists) return DEFAULT_SETTINGS

  const data = snapshot.data() as Partial<PaymentSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    methods: { ...DEFAULT_SETTINGS.methods, ...data.methods },
    checkout: { ...DEFAULT_SETTINGS.checkout, ...data.checkout },
  }
}

export async function savePaymentSettings(patch: Partial<PaymentSettings>): Promise<PaymentSettings> {
  const db = getAdminDb()
  const ref = db.collection(COLLECTION).doc(DOC_ID)

  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })

  const snapshot = await ref.get()
  const data = snapshot.data() as Partial<PaymentSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    methods: { ...DEFAULT_SETTINGS.methods, ...data.methods },
    checkout: { ...DEFAULT_SETTINGS.checkout, ...data.checkout },
  }
}
