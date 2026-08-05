"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { logoutUser } from "@/services/auth.service"
import { Button } from "@/components/ui/button"

const REASON_LABELS: Record<string, string> = {
  no_profile_at_this_uid: "No Firestore users/{uid} document exists for this signed-in account.",
  role_not_admin: "This account's role is not an admin role.",
  profile_lookup_threw: "Looking up the Firestore profile failed (see console for the error).",
}

export default function AdminAccessDeniedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const uid = searchParams.get("uid")
  const email = searchParams.get("email")
  const docPath = searchParams.get("docPath")
  const role = searchParams.get("role")
  const reason = searchParams.get("reason")

  useEffect(() => {
    if (uid) {
      console.log("[admin-access-denied] uid:", uid, "email:", email, "docPath:", docPath, "role:", role, "reason:", reason)
    }
  }, [uid, email, docPath, role, reason])

  async function handleSignOut() {
    await logoutUser()
    router.push("/admin/login")
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-[#f3f5f2] px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-xl sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="size-8 text-red-600" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-black">Access Denied</h1>
        <p className="mt-3 text-sm text-[#444444]">
          This account does not have permission to access the IXOFLORA admin panel. If you
          believe this is a mistake, contact a Super Admin.
        </p>

        {uid && (
          <div className="mt-6 rounded-xl bg-[#f3f5f2] p-4 text-left text-xs text-[#444444]">
            <p className="mb-2 font-semibold uppercase tracking-widest text-black">Diagnostic details</p>
            <p>
              <span className="font-medium text-black">Signed in as (uid):</span> {uid}
            </p>
            <p>
              <span className="font-medium text-black">Signed in as (email):</span> {email || "(no email on this account)"}
            </p>
            <p>
              <span className="font-medium text-black">Firestore document checked:</span> {docPath}
            </p>
            <p>
              <span className="font-medium text-black">Role found there:</span> {role}
            </p>
            <p className="mt-2">{reason ? REASON_LABELS[reason] : null}</p>
            {reason === "no_profile_at_this_uid" && (
              <p className="mt-2">
                If you expected to be signed in as a different account, sign out and sign back in with
                the correct Google account — this uid has no matching Firestore profile at all.
              </p>
            )}
          </div>
        )}

        <Button className="mt-6 h-11 w-full" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </div>
  )
}
