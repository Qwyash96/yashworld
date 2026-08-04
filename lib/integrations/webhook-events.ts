import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"

export interface IntegrationWebhookEvent {
  id: string
  providerId: string
  verified: boolean
  statusCode: number
  receivedAt: string
}

export async function writeWebhookEvent(entry: { providerId: string; verified: boolean; statusCode: number }): Promise<void> {
  try {
    await getAdminDb()
      .collection("integrationWebhookEvents")
      .add({ ...entry, receivedAt: new Date().toISOString() })
  } catch (error) {
    console.error("[integration-webhook-event] failed to write entry:", entry.providerId, error)
  }
}

export async function listRecentWebhookEvents(providerId: string, limitCount = 10): Promise<IntegrationWebhookEvent[]> {
  const snapshot = await getAdminDb()
    .collection("integrationWebhookEvents")
    .where("providerId", "==", providerId)
    .orderBy("receivedAt", "desc")
    .limit(limitCount)
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as IntegrationWebhookEvent)
}
