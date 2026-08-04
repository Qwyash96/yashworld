"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Users, Search, ShieldBan, ShieldCheck, Ban } from "lucide-react"
import { fetchBuyers, suspendBuyer, banBuyer, activateBuyer } from "@/lib/admin-users-client"
import { PaginationControls } from "@/components/admin/pagination-controls"
import type { UserProfile } from "@/types/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-yellow-100 text-yellow-800",
  banned: "bg-red-100 text-red-700",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadPage(cursor: string | null) {
    setLoading(true)
    const result = await fetchBuyers({
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
      cursor,
    })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setUsers(result.users)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
  }

  useEffect(() => {
    setCursorStack([null])
    setPageIndex(0)
    loadPage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim().toLowerCase())
  }

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

  async function handleAction(action: "suspend" | "ban" | "activate", uid: string) {
    const fn = action === "suspend" ? suspendBuyer : action === "ban" ? banBuyer : activateBuyer
    const result = await fn(uid)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Buyer ${action === "activate" ? "reactivated" : action + "ed"}.`)
    loadPage(cursorStack[pageIndex])
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Users className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Buyers</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every buyer account on the platform.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email prefix..."
            className="h-9 w-64"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9">
            <Search className="size-3.5" />
            Search
          </Button>
        </form>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && users === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : users && users.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#444444]">No buyers match this search/filter.</p>
        ) : (
          <div className="divide-y divide-border">
            {users?.map((user) => {
              const status = user.status ?? "active"
              return (
                <div key={user.uid} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/admin/users/${user.uid}`} className="min-w-0 hover:text-green-700">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-black">{user.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </div>
                    <p className="truncate text-sm text-[#444444]">{user.email}</p>
                    <p className="text-xs text-[#444444]">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {status !== "active" && (
                      <Button size="sm" variant="outline" className="h-9" onClick={() => handleAction("activate", user.uid)}>
                        <ShieldCheck className="size-3.5" />
                        {status === "banned" ? "Unban" : "Unsuspend"}
                      </Button>
                    )}
                    {status !== "suspended" && (
                      <Button size="sm" variant="outline" className="h-9" onClick={() => handleAction("suspend", user.uid)}>
                        <ShieldBan className="size-3.5" />
                        Suspend
                      </Button>
                    )}
                    {status !== "banned" && (
                      <Button size="sm" variant="destructive" className="h-9" onClick={() => handleAction("ban", user.uid)}>
                        <Ban className="size-3.5" />
                        Ban
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
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
