import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import { AD_POSITIONS, type AdPosition, type SponsoredAd } from "@/types/sponsored-ad"

type RouteContext = { params: Promise<{ id: string }> }

type Action = "approve" | "reject" | "pause" | "resume"
const ACTIONS: Action[] = ["approve", "reject", "pause", "resume"]

interface PatchBody {
  action?: Action
  rejectionReason?: string
  priority?: number
  position?: AdPosition
  startAt?: string
  endAt?: string
}

/**
 * The one admin management endpoint for a sponsored ad: workflow actions
 * (approve/reject/pause/resume) and plain field edits (priority, position,
 * schedule) share this route since they're all just a patch to the same
 * doc — matches the coupons/[code] PATCH convention.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminPermission(request, "coupons_offers")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const ref = getAdminDb().collection("sponsoredAds").doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })
  const ad = snap.data() as SponsoredAd

  const body = (await request.json()) as PatchBody
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }

  if (body.action) {
    if (!ACTIONS.includes(body.action)) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 })
    }
    if (body.action === "approve") {
      if (ad.status !== "paid") {
        return NextResponse.json({ error: `Cannot approve a promotion that is "${ad.status}".` }, { status: 409 })
      }
      const startAt = body.startAt ?? new Date().toISOString()
      const endAt = body.endAt ?? new Date(new Date(startAt).getTime() + ad.durationDays * 24 * 60 * 60 * 1000).toISOString()
      patch.status = "approved"
      patch.startAt = startAt
      patch.endAt = endAt
    } else if (body.action === "reject") {
      if (ad.status !== "pending" && ad.status !== "paid") {
        return NextResponse.json({ error: `Cannot reject a promotion that is "${ad.status}".` }, { status: 409 })
      }
      patch.status = "rejected"
      patch.rejectionReason = body.rejectionReason?.trim() || "Rejected by admin."
    } else if (body.action === "pause") {
      if (ad.status !== "approved") {
        return NextResponse.json({ error: `Cannot pause a promotion that is "${ad.status}".` }, { status: 409 })
      }
      patch.status = "paused"
    } else if (body.action === "resume") {
      if (ad.status !== "paused") {
        return NextResponse.json({ error: `Cannot resume a promotion that is "${ad.status}".` }, { status: 409 })
      }
      patch.status = "approved"
    }
  }

  if (body.priority !== undefined) patch.priority = body.priority
  if (body.position !== undefined) {
    if (!AD_POSITIONS.includes(body.position)) {
      return NextResponse.json({ error: "Invalid position." }, { status: 400 })
    }
    patch.position = body.position
  }
  if (body.startAt !== undefined && !body.action) patch.startAt = body.startAt
  if (body.endAt !== undefined && !body.action) patch.endAt = body.endAt

  await ref.update(patch)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: body.action ? `sponsored_ad.${body.action}` : "sponsored_ad.update",
    targetType: "sponsoredAd",
    targetId: id,
    after: patch,
  })

  const updated = await ref.get()
  return NextResponse.json({ ad: { id: updated.id, ...updated.data() } })
}
