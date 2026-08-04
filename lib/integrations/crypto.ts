import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to your environment.",
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).")
  }
  return key
}

/** iv:authTag:ciphertext, all base64 — one Firestore string field, never stored or logged decrypted. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":")
}

export function decryptSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":")
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted credential value.")
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()])
  return plaintext.toString("utf8")
}
