import "server-only"
import { getAdminDb } from "@/lib/firebase-admin"
import type { SellerNotificationInput } from "@/types/seller-notification"

/** Never throws into the caller — a notification failure should never fail the actual fulfillment action. */
export async function writeSellerNotification(input: SellerNotificationInput): Promise<void> {
  try {
    await getAdminDb()
      .collection("sellerNotifications")
      .add({ ...input, createdAt: new Date().toISOString() })
  } catch (error) {
    console.error("[seller-notification] failed to write:", input.type, error)
  }
}
