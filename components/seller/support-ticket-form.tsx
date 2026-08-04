"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
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
import { uploadSupportImage } from "@/services/storage.service"
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

const MAX_SCREENSHOTS = 3

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
  const uid = sellerId ?? buyerId ?? ""
  const [subject, setSubject] = useState("")
  const [problemType, setProblemType] = useState("")
  const [description, setDescription] = useState("")
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([])
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [mobile, setMobile] = useState("")
  const [preferredContactTime, setPreferredContactTime] = useState("")
  const [error, setError] = useState("")

  const [submitting, setSubmitting] = useState(false)

  async function handleScreenshotChange(file: File | undefined) {
    if (!file || !uid) return
    setUploadingScreenshot(true)
    try {
      const url = await uploadSupportImage(uid, file)
      setScreenshotUrls((prev) => [...prev, url].slice(0, MAX_SCREENSHOTS))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploadingScreenshot(false)
    }
  }

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
        ...(screenshotUrls.length > 0 ? { screenshotUrls } : {}),
        preferredContactTime,
      })
      toast.success("Support ticket created. Our team will reach out soon.")
      setSubject("")
      setProblemType("")
      setDescription("")
      setScreenshotUrls([])
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
        <Label htmlFor="ticket-screenshot">Upload Screenshots (optional, up to {MAX_SCREENSHOTS})</Label>
        {screenshotUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {screenshotUrls.map((url, i) => (
              <div key={url} className="relative size-16 overflow-hidden rounded-lg border border-border">
                <Image src={url} alt="" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setScreenshotUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove screenshot"
                  className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {screenshotUrls.length < MAX_SCREENSHOTS && (
          <div className="flex items-center gap-2">
            <input
              id="ticket-screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingScreenshot}
              onChange={(e) => {
                handleScreenshotChange(e.target.files?.[0])
                e.target.value = ""
              }}
              className="h-11 cursor-pointer text-sm text-black file:mr-4 file:h-full file:cursor-pointer file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:text-sm file:font-medium file:text-white hover:file:bg-green-700"
            />
            {uploadingScreenshot && <Loader2 className="size-4 animate-spin text-green-700" />}
          </div>
        )}
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

      <Button type="submit" className="mt-2 h-11" disabled={submitting || uploadingScreenshot}>
        {submitting ? "Submitting..." : "Submit Support Request"}
      </Button>
    </form>
  )
}
