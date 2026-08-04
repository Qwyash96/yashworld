"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { doc, setDoc } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { useStore } from "@/components/store-provider"
import { getUserProfile } from "@/services/user.service"
import type { UserRole } from "@/types/user"

const HEARTBEAT_INTERVAL_MS = 25_000

/**
 * Writes presence/{uid} every ~25s for any signed-in user (buyer, seller,
 * or admin — "Online/Active Users" on the admin dashboard is site-wide, not
 * just staff). Mounted once, near the root, via components/presence-heartbeat.tsx.
 */
export function usePresenceHeartbeat(): void {
  const { user } = useStore()
  const pathname = usePathname()
  const roleRef = useRef<UserRole | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function beat() {
      if (cancelled || !user) return
      if (!roleRef.current) {
        const profile = await getUserProfile(user.uid).catch(() => null)
        roleRef.current = profile?.role ?? "buyer"
      }
      if (cancelled) return
      await setDoc(
        doc(db, "presence", user.uid),
        { uid: user.uid, role: roleRef.current, lastSeenAt: new Date().toISOString(), currentPath: pathname },
        { merge: true },
      ).catch(() => {
        // Best-effort — presence is a display-only nicety, never worth surfacing an error for.
      })
    }

    beat()
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user, pathname])
}
