"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import { uploadSellerKycDoc } from "@/services/storage.service"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Phase = "idle" | "requesting" | "live" | "captured" | "uploading" | "done" | "error"

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : undefined
  switch (name) {
    case "NotAllowedError":
      return "Camera permission was denied. Please allow camera access in your browser settings and try again."
    case "NotFoundError":
      return "No camera was found on this device."
    case "NotReadableError":
      return "The camera is already in use by another application."
    default:
      return err instanceof Error ? err.message : "Could not access the camera."
  }
}

/**
 * Live front-camera selfie capture — no gallery/file upload path exists here
 * at all, unlike KycUploadField. Requests camera permission, shows a live
 * preview, captures a still frame to a canvas on demand, then uploads it
 * through the same trusted storage.service.ts path as every other KYC doc.
 */
export function LiveSelfieCapture({
  uid,
  value,
  onCaptured,
}: {
  uid: string
  /** Existing storage path — set when prefilling a resubmission. */
  value?: string
  onCaptured: (path: string) => void
}) {
  const [phase, setPhase] = useState<Phase>(value ? "done" : "idle")
  const [error, setError] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stopStream, [])

  // `useState(value ? "done" : "idle")` above only seeds `phase` from
  // `value` on the very first render — it never re-syncs if `value` only
  // becomes available (or changes) afterward, which is exactly the "captures
  // fine, then disappears" failure mode: the persisted selfie path is real
  // and correct in the parent's state, but this component's own local
  // `phase` never gets told about it. Only auto-advances FROM "idle" (never
  // interrupts an in-progress capture/upload, and never fights a deliberate
  // "Retake") so this is purely additive — a no-op whenever the mount-time
  // initializer already got it right.
  useEffect(() => {
    if (value && phase === "idle") setPhase("done")
  }, [value, phase])

  async function startCamera() {
    setError("")
    setPhase("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase("live")
    } catch (err) {
      setError(cameraErrorMessage(err))
      setPhase("error")
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    stopStream()
    setPhase("captured")
  }

  function retake() {
    setPhase("idle")
    startCamera()
  }

  async function confirm() {
    const canvas = canvasRef.current
    if (!canvas) return
    setPhase("uploading")
    setError("")
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError("Could not process the captured photo. Please try again.")
          setPhase("error")
          return
        }
        try {
          const file = new File([blob], "selfie.jpg", { type: "image/jpeg" })
          const path = await uploadSellerKycDoc(uid, "selfie", file)
          onCaptured(path)
          setPhase("done")
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed.")
          setPhase("error")
        }
      },
      "image/jpeg",
      0.9,
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>
        Live Selfie <span className="text-red-600">*</span>
      </Label>

      <div className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-[#f3f5f2]">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-video w-full object-cover ${phase === "live" ? "block" : "hidden"}`}
        />
        <canvas
          ref={canvasRef}
          className={`aspect-video w-full object-cover ${phase === "captured" || phase === "uploading" || phase === "done" ? "block" : "hidden"}`}
        />

        {phase === "idle" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="size-8 text-green-700" />
            <p className="text-sm text-[#444444]">
              Your selfie must be captured live using your camera — gallery uploads aren&apos;t accepted.
            </p>
            <Button type="button" onClick={startCamera}>
              Capture Live Selfie
            </Button>
          </div>
        )}

        {phase === "requesting" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center">
            <Loader2 className="size-6 animate-spin text-green-700" />
            <p className="text-sm text-[#444444]">Requesting camera access...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={startCamera}>
              Try Again
            </Button>
          </div>
        )}
      </div>

      {phase === "live" && (
        <Button type="button" className="w-full" onClick={capture}>
          <Camera className="size-4" />
          Capture
        </Button>
      )}

      {phase === "captured" && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={retake}>
            <RotateCcw className="size-4" />
            Retake
          </Button>
          <Button type="button" className="flex-1" onClick={confirm}>
            <CheckCircle2 className="size-4" />
            Confirm
          </Button>
        </div>
      )}

      {phase === "uploading" && (
        <Button type="button" className="w-full" disabled>
          <Loader2 className="size-4 animate-spin" />
          Saving...
        </Button>
      )}

      {phase === "done" && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 className="size-4" />
            Selfie captured
          </span>
          <Button type="button" variant="outline" size="sm" onClick={retake}>
            <RotateCcw className="size-4" />
            Retake
          </Button>
        </div>
      )}
    </div>
  )
}
