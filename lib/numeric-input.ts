/**
 * Shared helpers for controlled numeric text inputs (type="text"
 * inputMode="numeric"/"decimal" rather than type="number" — the browser's
 * native number input is what causes the "0"-prefill/leading-zero class of
 * bugs in the first place, since its value is always coerced through a
 * number). Every numeric-ish field in the app should route through one of
 * these instead of `Number(e.target.value)` directly.
 */

/** Strips zeros that precede another digit — "0" and "0.5" are left alone
 * (a lone/decimal-leading zero is a real, in-progress value), but "05" -> "5"
 * and "00123" -> "123". */
export function stripLeadingZeros(value: string): string {
  return value.replace(/^0+(?=\d)/, "")
}

/** Digits only, leading zeros stripped, optionally capped to a max length.
 * Use for magnitude fields where a leading zero is never meaningful: stock,
 * quantity, watering-frequency days, pincode. Do NOT use this for OTP or
 * bank account numbers — those are opaque digit strings where a leading
 * zero can be a real, valid character. */
export function sanitizeDigits(value: string, maxLength?: number): string {
  const digitsOnly = value.replace(/\D/g, "")
  const stripped = stripLeadingZeros(digitsOnly)
  return maxLength ? stripped.slice(0, maxLength) : stripped
}

/** Digits only, capped to a max length — no leading-zero stripping. Use for
 * OTP codes and bank account numbers, where every digit position (including
 * a leading zero) is a meaningful, real character rather than a magnitude. */
export function sanitizeOpaqueDigits(value: string, maxLength?: number): string {
  const digitsOnly = value.replace(/\D/g, "")
  return maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly
}

/** Indian mobile numbers never start with 0, so unlike sanitizeDigits (which
 * preserves a lone "0") this strips a leading zero unconditionally, capped
 * to 10 digits. */
export function sanitizeIndianMobile(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10)
}

/** Digits plus at most one decimal point, leading zeros stripped (but a
 * decimal-leading "0.5" is preserved). Use for price-like fields. */
export function sanitizeDecimal(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "")
  const dotIndex = cleaned.indexOf(".")
  if (dotIndex !== -1) {
    cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "")
  }
  return stripLeadingZeros(cleaned)
}
