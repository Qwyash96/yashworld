import "server-only"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import type { Campaign, CampaignParticipant } from "@/types/campaign"

const COLLECTION = "campaigns"
const PARTICIPANTS_COLLECTION = "campaignParticipants"

export function participantId(campaignId: string, sellerId: string): string {
  return `${campaignId}_${sellerId}`
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const snap = await getAdminDb().collection(COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as Campaign
}

export async function listCampaigns(): Promise<Campaign[]> {
  const snap = await getAdminDb().collection(COLLECTION).orderBy("createdAt", "desc").get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign)
}

export async function listParticipants(campaignId: string): Promise<CampaignParticipant[]> {
  const snap = await getAdminDb().collection(PARTICIPANTS_COLLECTION).where("campaignId", "==", campaignId).get()
  return snap.docs.map((d) => d.data() as CampaignParticipant)
}

export async function listSellerParticipations(sellerId: string): Promise<CampaignParticipant[]> {
  const snap = await getAdminDb().collection(PARTICIPANTS_COLLECTION).where("sellerId", "==", sellerId).get()
  return snap.docs.map((d) => d.data() as CampaignParticipant)
}

export async function getParticipant(campaignId: string, sellerId: string): Promise<CampaignParticipant | null> {
  const snap = await getAdminDb().collection(PARTICIPANTS_COLLECTION).doc(participantId(campaignId, sellerId)).get()
  if (!snap.exists) return null
  return snap.data() as CampaignParticipant
}

/** Pure — no I/O. Whether now falls inside the campaign's own window (ignores admin `status`, which the caller should also check for "cancelled"). */
export function isCampaignWithinWindow(campaign: Campaign, now: Date): boolean {
  return new Date(campaign.startAt) <= now && new Date(campaign.endAt) >= now
}

/** Removes the denormalized campaignOffer from every product carrying it —
 * used when a campaign is cancelled or edited such that it's no longer
 * active, so stale pricing can never be shown or trusted again. Single
 * equality filter on a nested field path, no composite index needed. */
export async function clearCampaignOfferFromProducts(campaignId: string): Promise<void> {
  const db = getAdminDb()
  const snap = await db.collection("products").where("campaignOffer.campaignId", "==", campaignId).get()
  if (snap.empty) return
  const batch = db.batch()
  snap.docs.forEach((doc) => batch.update(doc.ref, { campaignOffer: FieldValue.delete() }))
  await batch.commit()
}
