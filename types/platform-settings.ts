/** Firestore `platformSettings/commission` — the single, admin-editable
 * commission rate applied to every sale. Same shape/pattern as
 * types/payment-settings.ts's PaymentSettings. */
export interface PlatformSettings {
  defaultCommissionPercent: number
  updatedAt: string
}
