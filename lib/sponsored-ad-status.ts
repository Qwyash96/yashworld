import type { SponsoredAd, SponsoredAdStatus } from "@/types/sponsored-ad"

/**
 * "running" and "expired" are never a stored value — there's no scheduled
 * job in this app to flip a status at the right moment, so instead they're
 * derived every time from status === "approved" plus the [startAt, endAt]
 * window, exactly like banners derive "live" from active + startAt/endAt.
 * The raw stored `status` only ever holds pending/paid/approved/rejected/
 * paused; this is the one function that turns that into what a seller or
 * admin should actually see.
 */
export function getEffectiveAdStatus(ad: Pick<SponsoredAd, "status" | "startAt" | "endAt">): SponsoredAdStatus {
  if (ad.status !== "approved") return ad.status
  const now = new Date().toISOString()
  if (ad.endAt && ad.endAt < now) return "expired"
  if (ad.startAt && ad.startAt > now) return "approved"
  return "running"
}
