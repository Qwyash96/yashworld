"use client"

import { useEffect, useState } from "react"
import { fetchReports } from "@/lib/admin-reports-client"
import type { ReportsData } from "@/types/reports"

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Shared date-range + fetch state for all 5 report pages — one API call, reused each time the range changes. */
export function useReportsData() {
  const [from, setFrom] = useState(isoDaysAgo(29))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchReports(new Date(from).toISOString(), new Date(to + "T23:59:59.999Z").toISOString()).then((result) => {
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setData(result.data)
    })
  }, [from, to])

  return { from, to, setFrom, setTo, data, error, loading }
}
