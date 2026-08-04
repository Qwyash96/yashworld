"use client"

import { useEffect, useState } from "react"
import { useStore } from "@/components/store-provider"
import { getSellerApplication } from "@/services/seller.service"
import type { SellerApplication } from "@/types/seller"

type SellerGateState =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "not-applied" }
  | { state: "pending" }
  | { state: "rejected"; reason?: string }
  | { state: "approved"; uid: string; sellerId: string }

/** Resolves the signed-in user's seller KYC status, via Firestore. */
export function useSellerGate(): SellerGateState {
  const { user } = useStore()
  const [application, setApplication] = useState<SellerApplication | null | "loading">("loading")

  useEffect(() => {
    if (!user) {
      setApplication("loading")
      return
    }
    let cancelled = false
    getSellerApplication(user.uid).then((app) => {
      if (!cancelled) setApplication(app)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return { state: "signed-out" }
  if (application === "loading") return { state: "loading" }
  if (application === null) return { state: "not-applied" }
  if (application.status === "pending") return { state: "pending" }
  if (application.status === "rejected") return { state: "rejected", reason: application.rejectionReason }
  return { state: "approved", uid: user.uid, sellerId: application.sellerId! }
}
