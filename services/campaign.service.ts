import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore"
import { auth, db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Campaign, CampaignParticipant } from "@/types/campaign"

const CAMPAIGNS_COLLECTION = "campaigns"
const PARTICIPANTS_COLLECTION = "campaignParticipants"

function participantId(campaignId: string, sellerId: string): string {
  return `${campaignId}_${sellerId}`
}

/** Public — every visitor can browse admin campaigns (firestore.rules: public read). */
export async function listCampaigns(): Promise<Campaign[]> {
  try {
    const snapshot = await getDocs(collection(db, CAMPAIGNS_COLLECTION))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign)
  } catch (error) {
    throw toServiceError("Failed to fetch campaigns", error)
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const snapshot = await getDoc(doc(db, CAMPAIGNS_COLLECTION, id))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() } as Campaign
  } catch (error) {
    throw toServiceError(`Failed to fetch campaign "${id}"`, error)
  }
}

/** This seller's own invites/opt-ins/declines, across every campaign. */
export async function listSellerParticipations(sellerId: string): Promise<CampaignParticipant[]> {
  try {
    const q = query(collection(db, PARTICIPANTS_COLLECTION), where("sellerId", "==", sellerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as CampaignParticipant)
  } catch (error) {
    throw toServiceError(`Failed to fetch campaign participations for seller "${sellerId}"`, error)
  }
}

export async function getParticipant(campaignId: string, sellerId: string): Promise<CampaignParticipant | null> {
  try {
    const snapshot = await getDoc(doc(db, PARTICIPANTS_COLLECTION, participantId(campaignId, sellerId)))
    if (!snapshot.exists()) return null
    return snapshot.data() as CampaignParticipant
  } catch (error) {
    throw toServiceError(`Failed to fetch participant status for campaign "${campaignId}"`, error)
  }
}

/**
 * Declines an invite — a direct client write (just a status flip, no price
 * computation), allowed by firestore.rules only while status is still
 * "invited". Accepting an invite (or self-joining an open campaign) instead
 * goes through joinCampaign() below, since that needs the trusted
 * server-side price computation.
 */
export async function declineCampaignInvite(campaignId: string, sellerId: string): Promise<void> {
  try {
    await updateDoc(doc(db, PARTICIPANTS_COLLECTION, participantId(campaignId, sellerId)), {
      status: "declined",
      respondedAt: new Date().toISOString(),
    })
  } catch (error) {
    throw toServiceError(`Failed to decline campaign "${campaignId}"`, error)
  }
}

/**
 * Joins a campaign (accepting an invite, or self-serving into an "open" one)
 * via app/api/seller/campaigns/[id]/join — the one seller write that needs
 * the Admin SDK, since it computes and denormalizes the actual discounted
 * price onto each enrolled product.
 */
export async function joinCampaign(
  campaignId: string,
  productIds?: string[],
): Promise<{ ok: true; enrolledCount: number } | { ok: false; error: string }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in.")

  const response = await fetch(`/api/seller/campaigns/${campaignId}/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: body.error ?? "Failed to join campaign." }
  return { ok: true, enrolledCount: body.enrolledCount }
}
