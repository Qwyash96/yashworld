/** Indian mobile numbers: exactly 10 digits, starting 6-9 (no +91 prefix stored). */
export function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.trim())
}

/** PAN format: AAAAA9999A. Format-only check, not a real-registry lookup. */
export function isValidPan(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.trim().toUpperCase())
}

/** Aadhaar format: exactly 12 digits. Format-only check, not a Verhoeff checksum or UIDAI lookup. */
export function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(value.trim())
}

/** IFSC format: AAAA0999999 (4 letters, 0, 6 alphanumeric). */
export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase())
}

/** Loose equality for "does the bank account holder name match the registered name" — normalizes case/whitespace/punctuation. */
export function namesRoughlyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z]/g, "")
  return normalize(a) === normalize(b)
}
