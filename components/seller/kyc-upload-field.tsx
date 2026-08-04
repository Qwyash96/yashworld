"use client"

import { useState, type ChangeEvent } from "react"
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react"
import { uploadSellerKycDoc } from "@/services/storage.service"
import { Label } from "@/components/ui/label"

interface KycUploadFieldProps {
  id: string
  label: string
  required?: boolean
  accept?: string
  uid: string
  docKey: string
  /** Existing storage path — set when prefilling a resubmission. */
  value?: string
  onUploaded: (path: string) => void
}

/** One file-input tile for a KYC document — uploads to Storage on selection
 * and reports the resulting path back to the parent form. Used 5x in the
 * seller registration wizard (Aadhaar/PAN/selfie/bank proof/GST). */
export function KycUploadField({
  id,
  label,
  required,
  accept = "image/*,application/pdf",
  uid,
  docKey,
  value,
  onUploaded,
}: KycUploadFieldProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle")
  const [fileName, setFileName] = useState<string | null>(value ? value.split("/").pop() ?? null : null)
  const [error, setError] = useState("")

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError("")
    setStatus("uploading")
    setFileName(file.name)

    try {
      const path = await uploadSellerKycDoc(uid, docKey, file)
      onUploaded(path)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      // Reset so selecting the same file again (e.g. retry after fixing a
      // connection issue) fires onChange instead of being a no-op.
      e.target.value = ""
    }
  }

  const uploaded = !!value && status === "idle"

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition ${
          uploaded ? "border-green-300 bg-green-50" : "border-border bg-[#f3f5f2] hover:border-green-600"
        }`}
      >
        <span className="flex items-center gap-2 truncate text-black">
          {status === "uploading" ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-green-700" />
          ) : uploaded ? (
            <CheckCircle2 className="size-4 shrink-0 text-green-700" />
          ) : (
            <UploadCloud className="size-4 shrink-0 text-green-700" />
          )}
          <span className="truncate">{fileName ?? "Click to upload"}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-green-700">
          {status === "uploading" ? "Uploading..." : uploaded ? "Uploaded" : "Browse"}
        </span>
        <input id={id} type="file" accept={accept} className="hidden" onChange={handleChange} />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
