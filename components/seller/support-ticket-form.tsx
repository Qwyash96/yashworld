"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createSupportTicket } from "@/services/support-ticket.service"
import { sanitizeIndianMobile } from "@/lib/numeric-input"

const problemTypes = [
  "Registration Issue",
  "KYC Upload Problem",
  "Bank Details Issue",
  "Application Status Query",
  "Technical Issue",
  "Other",
]

const contactTimes = ["Morning (9am - 12pm)", "Afternoon (12pm - 4pm)", "Evening (4pm - 8pm)", "Anytime"]

const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-white p-3 text-sm text-black outline-none focus:border-primary"

export function SupportTicketForm({
  sellerId,
  buyerId,
  sellerName,
  onSubmitted,
}: {
  sellerId?: string
  buyerId?: string
  sellerName: string
  onSubmitted?: () => void
}) {
  const [subject, setSubject] = useState("")
  const [problemType, setProblemType] = useState("")
  const [description, setDescription] = useState("")
  const [screenshotFileName, setScreenshotFileName] = useState("")
  const [mobile, setMobile] = useState("")
  const [preferredContactTime, setPreferredContactTime] = useState("")
  const [error, setError] = useState("")

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !problemType || !description.trim() || !mobile.trim() || !preferredContactTime) {
      setError("Please fill in all required fields.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await createSupportTicket({
        ...(sellerId ? { sellerId } : {}),
        ...(buyerId ? { buyerId } : {}),
        sellerName,
        mobile: mobile.trim(),
        subject: subject.trim(),
        problemType,
        description: description.trim(),
        ...(screenshotFileName ? { screenshotFileName } : {}),
        preferredContactTime,
      })
      toast.success("Support ticket created. Our team will reach out soon.")
      setSubject("")
      setProblemType("")
      setDescription("")
      setScreenshotFileName("")
      setMobile("")
      setPreferredContactTime("")
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-problemType">Problem Type</Label>
        <Select value={problemType} onValueChange={(v) => setProblemType(v ?? "")}>
          <SelectTrigger id="ticket-problemType" className="h-11 w-full">
            <SelectValue placeholder="Select problem type" />
          </SelectTrigger>
          <SelectContent>
            {problemTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-description">Description</Label>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={textareaClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-screenshot">Upload Screenshot (optional)</Label>
        <input
          id="ticket-screenshot"
          type="file"
          accept="image/*"
          onChange={(e) => setScreenshotFileName(e.target.files?.[0]?.name ?? "")}
          className="h-11 cursor-pointer text-sm text-black file:mr-4 file:h-full file:cursor-pointer file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:text-sm file:font-medium file:text-white hover:file:bg-green-700"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-mobile">Phone Number</Label>
        <Input
          id="ticket-mobile"
          type="tel"
          inputMode="numeric"
          value={mobile}
          onChange={(e) => setMobile(sanitizeIndianMobile(e.target.value))}
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-contactTime">Preferred Contact Time</Label>
        <Select value={preferredContactTime} onValueChange={(v) => setPreferredContactTime(v ?? "")}>
          <SelectTrigger id="ticket-contactTime" className="h-11 w-full">
            <SelectValue placeholder="Select a time" />
          </SelectTrigger>
          <SelectContent>
            {contactTimes.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="mt-2 h-11" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Support Request"}
      </Button>
    </form>
  )
}
