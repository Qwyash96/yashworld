import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getCampaign, participantId } from "@/lib/campaigns"
import { writeAuditLog } from "@/lib/audit-log"

type RouteContext = { params: Promise<{ id: string }> }

interface InviteBody {
  sellerIds?: string[]
}

/** Invites one or more approved sellers to a campaign — creates "invited"
 * campaignParticipants docs they must still explicitly accept (opt in) or
 * decline; this never auto-enrolls anyone. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: campaignId } = await params
  const campaign = await getCampaign(campaignId)
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })

  const body = (await request.json()) as InviteBody
  const sellerIds = (body.sellerIds ?? []).filter((s): s is string => typeof s === "string" && !!s)
  if (sellerIds.length === 0) {
    return NextResponse.json({ error: "At least one seller must be selected." }, { status: 400 })
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  const applicationSnaps = await db.getAll(...sellerIds.map((uid) => db.collection("sellerApplications").doc(uid)))
  const invalid = applicationSnaps.filter((snap) => snap.data()?.status !== "approved").map((snap) => snap.id)
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Not approved sellers: ${invalid.join(", ")}` }, { status: 400 })
  }

  // Don't reset an already-participating seller back to "invited" — only
  // touch sellers who aren't already opted in.
  const participantRefs = sellerIds.map((sellerId) => db.collection("campaignParticipants").doc(participantId(campaignId, sellerId)))
  const participantSnaps = await db.getAll(...participantRefs)

  const batch = db.batch()
  let invitedCount = 0
  participantSnaps.forEach((snap, i) => {
    if (snap.data()?.status === "opted_in") return
    batch.set(participantRefs[i], { campaignId, sellerId: sellerIds[i], status: "invited", invitedAt: now }, { merge: true })
    invitedCount++
  })
  await batch.commit()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "campaign.invite",
    targetType: "campaign",
    targetId: campaignId,
    after: { invitedCount, sellerIds },
  })

  return NextResponse.json({ invited: invitedCount })
}
