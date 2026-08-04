"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Trash2, UserPlus } from "lucide-react"
import {
  fetchCampaign,
  updateCampaign,
  deleteCampaign,
  inviteSellersToCampaign,
  fetchCampaignParticipants,
} from "@/lib/admin-campaigns-client"
import { getSellerApplicationsByStatus } from "@/services/seller.service"
import { formatPrice } from "@/lib/products"
import type { Campaign, CampaignParticipant, CampaignStatus } from "@/types/campaign"
import type { SellerApplication } from "@/types/seller"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-gray-200 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-800",
  ended: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
}

const PARTICIPANT_STYLES: Record<CampaignParticipant["status"], string> = {
  invited: "bg-blue-100 text-blue-700",
  opted_in: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
}

export default function AdminCampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [participants, setParticipants] = useState<CampaignParticipant[]>([])
  const [approvedSellers, setApprovedSellers] = useState<SellerApplication[]>([])
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  function refresh() {
    fetchCampaign(params.id).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCampaign(result.campaign)
    })
    fetchCampaignParticipants(params.id).then((result) => {
      if (result.ok) setParticipants(result.participants)
    })
  }

  useEffect(() => {
    refresh()
    getSellerApplicationsByStatus("approved").then(setApprovedSellers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  if (!campaign) return null

  const participatingIds = new Set(participants.map((p) => p.sellerId))
  const invitableSellers = approvedSellers.filter((s) => !participatingIds.has(s.uid))

  async function handleStatusChange(status: CampaignStatus) {
    const result = await updateCampaign(campaign!.id, { status })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCampaign(result.campaign)
    toast.success(`Campaign marked ${status}.`)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${campaign!.name}"? This clears its discount from every enrolled product.`)) return
    const result = await deleteCampaign(campaign!.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Campaign deleted.")
    router.push("/admin/campaigns")
  }

  async function handleInvite() {
    if (selectedSellerIds.length === 0) return
    setInviting(true)
    const result = await inviteSellersToCampaign(campaign!.id, selectedSellerIds)
    setInviting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Invited ${result.invited} seller${result.invited === 1 ? "" : "s"}.`)
    setSelectedSellerIds([])
    refresh()
  }

  return (
    <div>
      <Link href="/admin/campaigns" className="flex items-center gap-1 text-sm text-[#444444] hover:text-green-700">
        <ArrowLeft className="size-4" />
        Back to Campaigns
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-black">{campaign.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[campaign.status]}`}>
            {campaign.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={campaign.status} onValueChange={(v) => v && handleStatusChange(v as CampaignStatus)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" className="h-9" onClick={handleDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <p className="mt-2 text-sm text-[#444444]">
        {campaign.discountType === "percent" ? `${campaign.discountValue}% off` : `${formatPrice(campaign.discountValue)} off`}
        {" · "}
        {new Date(campaign.startAt).toLocaleString()} – {new Date(campaign.endAt).toLocaleString()}
        {" · "}
        {campaign.enrollmentMode === "open" ? "Open enrollment" : "Invite only"}
        {campaign.categoryIds?.length ? ` · Restricted to ${campaign.categoryIds.length} categories` : ""}
      </p>

      {campaign.stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-black">{campaign.stats.ordersCount}</p>
            <p className="text-sm text-[#444444]">Orders</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-black">{formatPrice(campaign.stats.revenue)}</p>
            <p className="text-sm text-[#444444]">Revenue</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-black">{formatPrice(campaign.stats.discountGiven)}</p>
            <p className="text-sm text-[#444444]">Discount Given</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">
            Participants ({participants.length})
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {participants.length === 0 && <p className="text-sm text-[#444444]">No sellers yet.</p>}
            {participants.map((p) => (
              <div key={p.sellerId} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm">
                <span className="text-black">{approvedSellers.find((s) => s.uid === p.sellerId)?.shopName ?? p.sellerId}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PARTICIPANT_STYLES[p.status]}`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">Invite Sellers</h2>
          <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-white p-2">
            {invitableSellers.length === 0 && <p className="p-2 text-sm text-[#444444]">No more sellers to invite.</p>}
            {invitableSellers.map((s) => (
              <label key={s.uid} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f3f5f2]">
                <input
                  type="checkbox"
                  checked={selectedSellerIds.includes(s.uid)}
                  onChange={() =>
                    setSelectedSellerIds((ids) => (ids.includes(s.uid) ? ids.filter((i) => i !== s.uid) : [...ids, s.uid]))
                  }
                />
                {s.shopName} — {s.fullName}
              </label>
            ))}
          </div>
          <Button className="mt-3 h-10" onClick={handleInvite} disabled={inviting || selectedSellerIds.length === 0}>
            <UserPlus className="size-4" />
            {inviting ? "Inviting..." : `Invite ${selectedSellerIds.length || ""} Seller${selectedSellerIds.length === 1 ? "" : "s"}`}
          </Button>
        </section>
      </div>
    </div>
  )
}
