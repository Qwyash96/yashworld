"use client"

import { useEffect, useMemo, useState } from "react"
import { LifeBuoy, Phone, FileImage } from "lucide-react"
import { toast } from "sonner"
import { getAllSupportTickets, updateTicketStatus } from "@/services/support-ticket.service"
import type { SupportTicket, TicketStatus } from "@/types/support-ticket"
import { Button } from "@/components/ui/button"

const statusTabs: { key: TicketStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
]

const statusStyles: Record<TicketStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all")

  function refresh() {
    getAllSupportTickets().then(setTickets)
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(
    () => tickets.filter((t) => statusFilter === "all" || t.status === statusFilter),
    [tickets, statusFilter]
  )

  async function setStatus(id: string, status: TicketStatus) {
    await updateTicketStatus(id, status)
    toast.success("Ticket updated")
    refresh()
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <LifeBuoy className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Support Tickets</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Support requests submitted by buyers and sellers.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-green-600 text-white"
                : "bg-[#f3f5f2] text-black hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-[#f3f5f2] p-10 text-center text-sm text-[#444444]">
            No support tickets in this category yet.
          </p>
        ) : (
          filtered.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
                    {ticket.id}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-black">{ticket.subject}</h3>
                  <p className="text-xs text-[#444444]">
                    {ticket.sellerName} · {ticket.problemType}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[ticket.status]}`}
                >
                  {ticket.status.replace("_", " ")}
                </span>
              </div>

              <p className="mt-3 text-sm text-black">{ticket.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#444444]">
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5 text-green-700" />
                  {ticket.mobile}
                </span>
                {ticket.screenshotFileName && (
                  <span className="flex items-center gap-1">
                    <FileImage className="size-3.5 text-green-700" />
                    {ticket.screenshotFileName}
                  </span>
                )}
                <span>Preferred time: {ticket.preferredContactTime}</span>
                <span>Submitted: {formatDate(ticket.createdAt)}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(ticket.id, "open")}>
                  Open Ticket
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(ticket.id, "in_progress")}>
                  Mark In Progress
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(ticket.id, "resolved")}>
                  Resolved
                </Button>
                <Button size="sm" className="h-8" render={<a href={`tel:${ticket.mobile}`} />}>
                  Call Seller
                </Button>
                <Button size="sm" variant="destructive" className="h-8" onClick={() => setStatus(ticket.id, "closed")}>
                  Close Ticket
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
