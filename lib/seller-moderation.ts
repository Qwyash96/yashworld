import "server-only"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import type { SellerApplicationStatus, SellerModerationEvent } from "@/types/seller"

export type ModerationAction = "rejected" | "resubmission_requested" | "suspended" | "banned"

const ACTION_TO_STATUS: Record<ModerationAction, SellerApplicationStatus> = {
  rejected: "rejected",
  resubmission_requested: "resubmission_requested",
  suspended: "suspended",
  banned: "banned",
}

// reject/request-reupload only make sense on a still-pending application;
// suspend/ban only make sense on an already-live (approved) seller — ban can
// also escalate from an existing suspension.
const ALLOWED_FROM_STATUS: Record<ModerationAction, SellerApplicationStatus[]> = {
  rejected: ["pending"],
  resubmission_requested: ["pending"],
  suspended: ["approved"],
  banned: ["approved", "suspended"],
}

type ModerationResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Shared "reason required, negative status" path for reject / request
 * re-upload / suspend / ban — the four admin actions that all move a seller
 * OUT of good standing. Approve/reactivate stays in its own route since it
 * has a different shape (mints a Seller ID on first approval).
 */
export async function applyModerationAction(
  uid: string,
  action: ModerationAction,
  reason: string,
  byUid: string,
): Promise<ModerationResult> {
  const db = getAdminDb()
  const applicationRef = db.collection("sellerApplications").doc(uid)
  const sellerRef = db.collection("sellers").doc(uid)
  const snapshot = await applicationRef.get()

  if (!snapshot.exists) {
    return { ok: false, status: 404, error: "Seller application not found." }
  }

  const current = snapshot.data()!.status as SellerApplicationStatus
  if (!ALLOWED_FROM_STATUS[action].includes(current)) {
    return {
      ok: false,
      status: 400,
      error: `Cannot apply this action while the application is "${current}".`,
    }
  }

  const now = new Date().toISOString()
  const status = ACTION_TO_STATUS[action]
  const event: SellerModerationEvent = { action, reason, byUid, at: now }

  await applicationRef.update({
    status,
    rejectionReason: reason,
    updatedAt: now,
    moderationHistory: FieldValue.arrayUnion(event),
  })

  if (action === "suspended" || action === "banned") {
    const sellerSnap = await sellerRef.get()
    if (sellerSnap.exists) {
      await sellerRef.update({ status })
    }
  }

  if (action === "banned") {
    await getAdminAuth()
      .updateUser(uid, { disabled: true })
      .catch(() => {})
  }

  return { ok: true }
}
