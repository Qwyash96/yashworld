"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"
import { fetchAuditLogs } from "@/lib/admin-audit-logs-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import type { AuditLogEntry } from "@/types/audit-log"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminAuditLogsPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)
  const [targetType, setTargetType] = useState("")
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchAuditLogs({ targetType: targetType || undefined, cursor })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setEntries(result.entries)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => {
    setCursorStack([null])
    setPageIndex(0)
    loadPage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType])

  function handleNext() {
    if (!hasMore || !nextCursor) return
    const newStack = [...cursorStack.slice(0, pageIndex + 1), nextCursor]
    setCursorStack(newStack)
    setPageIndex(pageIndex + 1)
    loadPage(nextCursor)
  }

  function handlePrevious() {
    if (pageIndex === 0) return
    setPageIndex(pageIndex - 1)
    loadPage(cursorStack[pageIndex - 1])
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Audit Logs</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every admin action, recorded automatically. Super Admin only.</p>

      <div className="mt-6 flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="target-type" className="text-xs">
            Filter by target type (optional)
          </Label>
          <Input
            id="target-type"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            placeholder="e.g. sellerApplication, order, coupon..."
            className="h-9 w-72"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && entries === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : entries && entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No audit log entries yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {entries?.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-black">{entry.action}</span>
                  <span className="text-xs text-[#888888]">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[#444444]">
                  {entry.actorEmail} ({entry.actorRole}) on {entry.targetType} <span className="font-mono">{entry.targetId}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaginationControls
        onPrevious={handlePrevious}
        onNext={handleNext}
        canGoPrevious={pageIndex > 0}
        canGoNext={hasMore}
        loading={loading}
      />
    </div>
  )
}
