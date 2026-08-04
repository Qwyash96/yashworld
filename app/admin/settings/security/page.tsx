"use client"

import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { collection, getDocs, orderBy, query, where } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import type { LoginHistoryEntry } from "@/types/login-history"

/**
 * Read-only "your recent logins" — the write side (2FA, forced session
 * revocation) is a materially larger auth feature, deliberately deferred
 * (see the Explicitly Out of Scope note in the implementation plan).
 */
export default function SecuritySettingsPage() {
  const admin = useAdminAuth()
  const [logins, setLogins] = useState<LoginHistoryEntry[] | null>(null)

  useEffect(() => {
    const q = query(collection(db, "loginHistory"), where("uid", "==", admin.uid), orderBy("at", "desc"))
    getDocs(q).then((snap) => setLogins(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoginHistoryEntry)))
  }, [admin.uid])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Security</h1>
        <p className="mt-1 text-sm text-[#444444]">Your own recent sign-ins to this admin account.</p>
      </div>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#444444]">
          <ShieldCheck className="size-4 text-green-700" />
          Recent Logins
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {logins === null ? (
            <p className="text-sm text-[#444444]">Loading...</p>
          ) : logins.length === 0 ? (
            <p className="text-sm text-[#444444]">No recorded logins yet.</p>
          ) : (
            logins.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                <span className="text-black">{new Date(l.at).toLocaleString()}</span>
                <span className="text-xs text-[#444444]">{l.method}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
