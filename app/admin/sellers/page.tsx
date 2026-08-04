"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { getSellerApplicationsByStatus } from "@/services/seller.service"
import type { SellerApplication, SellerApplicationStatus } from "@/types/seller"

const tabs: { key: SellerApplicationStatus; label: string }[] = [
  { key: "pending", label: "Pending KYC" },
  { key: "approved", label: "Approved Sellers" },
  { key: "rejected", label: "Rejected Sellers" },
  { key: "resubmission_requested", label: "Re-upload Requested" },
  { key: "suspended", label: "Suspended" },
  { key: "banned", label: "Banned" },
]

const statusStyles: Record<SellerApplicationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  resubmission_requested: "bg-orange-100 text-orange-700",
  suspended: "bg-gray-200 text-gray-700",
  banned: "bg-red-200 text-red-900",
}

const statusLabels: Record<SellerApplicationStatus, string> = {
  pending: "pending",
  approved: "Active",
  rejected: "rejected",
  resubmission_requested: "re-upload requested",
  suspended: "suspended",
  banned: "banned",
}

export default function AdminSellersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStatus = (searchParams.get("status") as SellerApplicationStatus | null) ?? "pending"
  const [activeTab, setActiveTab] = useState<SellerApplicationStatus>(initialStatus)
  const [applications, setApplications] = useState<SellerApplication[] | null>(null)

  useEffect(() => {
    setApplications(null)
    getSellerApplicationsByStatus(activeTab).then(setApplications)
  }, [activeTab])

  function selectTab(tab: SellerApplicationStatus) {
    setActiveTab(tab)
    router.replace(`/admin/sellers?status=${tab}`)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Users className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Seller Management</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Review seller KYC applications and manage seller status.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => selectTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-green-600 text-white"
                : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {applications === null ? (
          <p className="p-8 text-center text-sm text-[#444444]">Loading...</p>
        ) : applications.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No sellers in this category yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {applications.map((application) => (
              <Link
                key={application.uid}
                href={`/admin/sellers/${application.uid}`}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-green-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-black">{application.shopName}</p>
                  <p className="text-sm text-[#444444]">{application.fullName}</p>
                  <p className="text-xs text-[#444444]">
                    {application.city}, {application.state}
                    {application.sellerId && ` · ${application.sellerId}`}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[application.status]}`}
                >
                  {statusLabels[application.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
