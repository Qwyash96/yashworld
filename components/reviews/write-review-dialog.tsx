"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { submitReview } from "@/lib/reviews-client"
import { uploadReviewImage } from "@/services/storage.service"
import { ReviewStarsInput } from "@/components/reviews/review-stars"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { Review } from "@/types/review"

const MAX_IMAGES = 3

export function WriteReviewDialog({
  open,
  onOpenChange,
  orderId,
  productId,
  productName,
  buyerName,
  buyerUid,
  existingReview,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  productId: string
  productName: string
  buyerName: string
  buyerUid: string
  existingReview: Review | null
  onSaved: (review: Review) => void
}) {
  const [rating, setRating] = useState(existingReview?.rating ?? 5)
  const [text, setText] = useState(existingReview?.text ?? "")
  const [images, setImages] = useState<string[]>(existingReview?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setRating(existingReview?.rating ?? 5)
    setText(existingReview?.text ?? "")
    setImages(existingReview?.images ?? [])
  }, [open, existingReview])

  async function handleImageChange(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadReviewImage(buyerUid, file)
      setImages((prev) => [...prev, url].slice(0, MAX_IMAGES))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    const result = await submitReview({ orderId, productId, buyerName, rating, text: text.trim(), images })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(existingReview ? "Review updated." : "Review submitted.")
    onSaved(result.review)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{existingReview ? "Edit Your Review" : "Write a Review"}</DialogTitle>
        <p className="text-sm text-muted-foreground">{productName}</p>

        <div className="mt-2 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Rating</p>
            <ReviewStarsInput value={rating} onChange={setRating} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Your Review</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What did you think of this product?"
              className="min-h-24 w-full rounded-lg border border-border bg-white p-3 text-sm text-black outline-none focus:border-primary"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Photos (optional, up to {MAX_IMAGES})</p>
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={url} className="relative size-16 overflow-hidden rounded-lg border border-border">
                    <Image src={url} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove photo"
                      className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    handleImageChange(e.target.files?.[0])
                    e.target.value = ""
                  }}
                  className="h-11 cursor-pointer text-sm text-black file:mr-4 file:h-full file:cursor-pointer file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:text-sm file:font-medium file:text-white hover:file:bg-green-700"
                />
                {uploading && <Loader2 className="size-4 animate-spin text-green-700" />}
              </div>
            )}
          </div>

          <Button type="button" className="h-11" disabled={submitting || uploading} onClick={handleSubmit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : existingReview ? "Update Review" : "Submit Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
