"use client"

import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat"

/** Renders nothing — just mounts the heartbeat hook. Placed inside StoreProvider in app/layout.tsx. */
export function PresenceHeartbeat() {
  usePresenceHeartbeat()
  return null
}
