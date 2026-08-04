"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { UserCog, Pencil, Trash2, Ban, CheckCircle2, Mail, X } from "lucide-react"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { ROLE_LABELS, ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles"
import { sanitizeIndianMobile } from "@/lib/numeric-input"
import {
  fetchStaffList,
  inviteStaffMember,
  updateStaffAccount,
  deleteStaffAccount,
  suspendStaffAccount,
  activateStaffAccount,
  updateInviteRole,
  cancelInvite,
} from "@/lib/admin-staff-client"
import type { UserProfile } from "@/types/user"
import type { StaffInvite } from "@/types/staff-invite"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roleBadgeStyles: Record<AdminRole, string> = {
  super_admin: "bg-green-700 text-white",
  admin: "bg-indigo-100 text-indigo-700",
  operations: "bg-blue-100 text-blue-700",
  catalog_manager: "bg-teal-100 text-teal-700",
  support: "bg-cyan-100 text-cyan-700",
  finance: "bg-yellow-100 text-yellow-800",
  marketing: "bg-orange-100 text-orange-700",
}

const emptyInviteForm = {
  email: "",
  mobile: "",
  department: "",
  role: "support" as AdminRole,
}

const emptyEditForm = {
  fullName: "",
  email: "",
  mobile: "",
  department: "",
  role: "support" as AdminRole,
}

export default function AdminStaffPage() {
  const currentAdmin = useAdminAuth()
  const [staff, setStaff] = useState<UserProfile[]>([])
  const [invites, setInvites] = useState<StaffInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all")

  const [inviteSheetOpen, setInviteSheetOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [inviteError, setInviteError] = useState("")
  const [inviting, setInviting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    const result = await fetchStaffList()
    if (result.ok) {
      setStaff(result.staff)
      setInvites(result.invites)
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function openInvite() {
    setInviteForm(emptyInviteForm)
    setInviteError("")
    setInviteSheetOpen(true)
  }

  function openEdit(member: UserProfile) {
    setEditingId(member.uid)
    setEditForm({
      fullName: member.name,
      email: member.email,
      mobile: member.mobile ?? "",
      department: member.department ?? "",
      role: member.role as AdminRole,
    })
    setEditError("")
  }

  async function handleInvite() {
    if (!inviteForm.email.trim()) {
      setInviteError("Email is required.")
      return
    }
    setInviting(true)
    const result = await inviteStaffMember({
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      mobile: inviteForm.mobile.trim() || undefined,
      department: inviteForm.department.trim() || undefined,
    })
    setInviting(false)
    if (!result.ok) {
      setInviteError(result.error)
      return
    }
    toast.success(
      result.status === "activated"
        ? "This Gmail already has an account — role assigned immediately."
        : "Invite sent. They'll get this role the next time they sign in with Google.",
    )
    setInviteSheetOpen(false)
    refresh()
  }

  async function handleSaveEdit() {
    if (!editingId) return
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      setEditError("Please fill in all fields.")
      return
    }
    setSaving(true)
    const result = await updateStaffAccount(editingId, {
      fullName: editForm.fullName.trim(),
      email: editForm.email.trim(),
      mobile: editForm.mobile.trim(),
      department: editForm.department.trim(),
      role: editForm.role,
    })
    setSaving(false)
    if (!result.ok) {
      setEditError(result.error)
      return
    }
    toast.success("Staff account updated")
    setEditingId(null)
    refresh()
  }

  async function handleDelete(member: UserProfile) {
    if (member.uid === currentAdmin.uid) {
      toast.error("You cannot delete your own account.")
      return
    }
    if (member.role === "super_admin" && staff.filter((s) => s.role === "super_admin").length <= 1) {
      toast.error("At least one Super Admin must remain.")
      return
    }
    if (window.confirm(`Delete ${member.name}'s admin account? This cannot be undone.`)) {
      const result = await deleteStaffAccount(member.uid)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Staff account deleted")
      refresh()
    }
  }

  async function handleToggleSuspend(member: UserProfile) {
    if (member.uid === currentAdmin.uid) {
      toast.error("You cannot suspend your own account.")
      return
    }
    const result =
      member.status === "suspended" ? await activateStaffAccount(member.uid) : await suspendStaffAccount(member.uid)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(member.status === "suspended" ? `${member.name} reactivated` : `${member.name} suspended`)
    refresh()
  }

  async function handleInviteRoleChange(invite: StaffInvite, role: AdminRole) {
    const result = await updateInviteRole(invite.email, role)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Invite updated")
    refresh()
  }

  async function handleCancelInvite(invite: StaffInvite) {
    if (window.confirm(`Cancel the invite for ${invite.email}?`)) {
      const result = await cancelInvite(invite.email)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Invite cancelled")
      refresh()
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserCog className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Staff Management</h1>
        </div>
        <Button className="h-10" onClick={openInvite}>
          Invite Staff
        </Button>
      </div>
      <p className="mt-1 text-sm text-[#444444]">
        Only Super Admin can invite, edit or remove staff accounts. Staff sign in with Google —
        enter their Gmail address and assign a role; the system recognizes them automatically the
        next time they sign in.
      </p>

      {invites.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#444444]">
            Pending Invites — Awaiting First Login
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {invites.map((invite) => (
              <div
                key={invite.email}
                className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-[#f3f5f2] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-black">
                  <Mail className="size-4 text-green-700" />
                  {invite.email}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={invite.role}
                    onValueChange={(v) => v && handleInviteRoleChange(invite, v as AdminRole)}
                  >
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMIN_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9" onClick={() => handleCancelInvite(invite)}>
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium text-black">Filter by role</span>
        <Select value={roleFilter} onValueChange={(v) => v && setRoleFilter(v as AdminRole | "all")}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ADMIN_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {loading && <p className="text-sm text-[#444444]">Loading staff accounts...</p>}
        {!loading && staff.length === 0 && (
          <p className="text-sm text-[#444444]">No staff accounts found.</p>
        )}
        {!loading && staff.length > 0 && staff.filter((m) => roleFilter === "all" || m.role === roleFilter).length === 0 && (
          <p className="text-sm text-[#444444]">No staff accounts with this role.</p>
        )}
        {staff.filter((m) => roleFilter === "all" || m.role === roleFilter).map((member) => (
          <div
            key={member.uid}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-black">{member.name}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeStyles[member.role as AdminRole]}`}
                >
                  {ROLE_LABELS[member.role as AdminRole]}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    member.status !== "suspended" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {member.status !== "suspended" ? "Active" : "Suspended"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#444444]">
                {member.email} · {member.mobile || "No mobile"}
              </p>
              <p className="text-xs text-[#444444]">{member.department}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-9" onClick={() => openEdit(member)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => handleToggleSuspend(member)}>
                {member.status !== "suspended" ? (
                  <>
                    <Ban className="size-3.5" />
                    Suspend
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Activate
                  </>
                )}
              </Button>
              <Button size="sm" variant="destructive" className="h-9" onClick={() => handleDelete(member)}>
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Staff */}
      <Sheet open={inviteSheetOpen} onOpenChange={setInviteSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Invite Staff</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm text-[#444444]">
              Enter their Gmail address and assign a role. If they already have an account it's
              upgraded immediately; otherwise the role applies automatically on their first Google
              sign-in.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Gmail Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@gmail.com"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, role: (v as AdminRole) ?? f.role }))}
              >
                <SelectTrigger id="invite-role" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-mobile">Mobile (optional)</Label>
              <Input
                id="invite-mobile"
                type="tel"
                inputMode="numeric"
                value={inviteForm.mobile}
                onChange={(e) => setInviteForm((f) => ({ ...f, mobile: sanitizeIndianMobile(e.target.value) }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-department">Department (optional)</Label>
              <Input
                id="invite-department"
                value={inviteForm.department}
                onChange={(e) => setInviteForm((f) => ({ ...f, department: e.target.value }))}
                className="h-11"
              />
            </div>

            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

            <Button className="mt-2 h-11" onClick={handleInvite} disabled={inviting}>
              {inviting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Staff */}
      <Sheet open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Edit Staff</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-mobile">Mobile</Label>
              <Input
                id="edit-mobile"
                type="tel"
                inputMode="numeric"
                value={editForm.mobile}
                onChange={(e) => setEditForm((f) => ({ ...f, mobile: sanitizeIndianMobile(e.target.value) }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={editForm.department}
                onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: (v as AdminRole) ?? f.role }))}
              >
                <SelectTrigger id="edit-role" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}

            <Button className="mt-2 h-11" onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
