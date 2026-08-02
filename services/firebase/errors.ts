/** Normalizes a raw Firebase/Firestore error into a readable, catchable Error. */
export function toServiceError(context: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "Unknown error"
  return new Error(`${context}: ${message}`)
}
