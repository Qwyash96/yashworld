"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/components/store-provider"
import { getReviewsForProduct } from "@/services/review.service"
import { replyToReview } from "@/lib/reviews-client"
import { ReviewStars } from "@/components/reviews/review-stars"
import { Button } from "@/components/ui/button"
import type { Review } from "@/types/review"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function SellerReplyForm({ reviewId, onReplied }: { reviewId: string; onReplied: (reply: string) => void }) {
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true)
    const result = await replyToReview(reviewId, text.trim())
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Reply posted.")
    onReplied(text.trim())
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply to this review as the seller..."
        className="min-h-16 w-full rounded-lg border border-border bg-white p-2 text-sm text-black outline-none focus:border-primary"
      />
      <Button type="button" size="sm" className="w-fit" disabled={submitting || !text.trim()} onClick={handleSubmit}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : "Post Reply"}
      </Button>
    </div>
  )
}

export function ReviewsSection({ productId, sellerId }: { productId: string; sellerId?: string }) {
  const { user } = useStore()
  const [reviews, setReviews] = useState<Review[] | "loading">("loading")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  useEffect(() => {
    getReviewsForProduct(productId).then(setReviews)
  }, [productId])

  const isSeller = !!user && !!sellerId && user.uid === sellerId

  function applyReply(reviewId: string, sellerReply: string) {
    setReviews((prev) => (prev === "loading" ? prev : prev.map((r) => (r.id === reviewId ? { ...r, sellerReply } : r))))
    setReplyingTo(null)
  }

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Customer Reviews</h2>

      {reviews === "loading" && (
        <p className="mt-4 text-sm text-muted-foreground">Loading reviews...</p>
      )}

      {reviews !== "loading" && reviews.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No reviews yet. Be the first to review this product.</p>
      )}

      {reviews !== "loading" && reviews.length > 0 && (
        <ul className="mt-6 space-y-6">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-black">{review.buyerName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <ReviewStars rating={review.rating} size="sm" />
                    <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
              </div>

              {review.text && <p className="mt-3 text-sm text-[#333333]">{review.text}</p>}

              {review.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative size-16 overflow-hidden rounded-md border border-border">
                      <Image src={url} alt="Review photo" fill className="object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {review.sellerReply ? (
                <div className="mt-3 rounded-md bg-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Seller Response
                  </p>
                  <p className="mt-1 text-sm text-[#333333]">{review.sellerReply}</p>
                </div>
              ) : (
                isSeller && (
                  <div className="mt-3">
                    {replyingTo === review.id ? (
                      <SellerReplyForm reviewId={review.id} onReplied={(reply) => applyReply(review.id, reply)} />
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => setReplyingTo(review.id)}>
                        Reply as Seller
                      </Button>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
