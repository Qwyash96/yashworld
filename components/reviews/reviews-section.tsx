"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { BadgeCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/components/store-provider"
import { getReviewsForProduct } from "@/services/review.service"
import { replyToReview } from "@/lib/reviews-client"
import { ReviewStars } from "@/components/reviews/review-stars"
import { Button } from "@/components/ui/button"
import type { Review } from "@/types/review"

/** Star breakdown + average, computed from the real review list — no
 * separate aggregate to keep in sync. */
function RatingSummary({ reviews }: { reviews: Review[] }) {
  const total = reviews.length
  const average = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0
  const counts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => Math.round(r.rating) === star).length)

  return (
    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col items-center gap-1 sm:items-start">
        <p className="text-4xl font-bold text-black">{average.toFixed(1)}</p>
        <ReviewStars rating={average} size="md" />
        <p className="text-xs text-muted-foreground">
          {total} review{total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star, i) => {
          const count = counts[i]!
          const percent = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-muted-foreground">{star} star</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right text-muted-foreground">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    <section className="mt-10 border-t border-border pt-6 sm:mt-12">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Customer Reviews</h2>

      {reviews === "loading" && (
        <p className="mt-4 text-sm text-muted-foreground">Loading reviews...</p>
      )}

      {reviews !== "loading" && reviews.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No reviews yet. Be the first to review this product.</p>
      )}

      {reviews !== "loading" && reviews.length > 0 && <RatingSummary reviews={reviews} />}

      {reviews !== "loading" && reviews.length > 0 && (
        <ul className="mt-6 space-y-6">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-black">{review.buyerName}</p>
                    {/* Every review is keyed orderId_productId and can only be
                        created by that order's buyer (see firestore.rules) —
                        true by construction, not an inferred/fake label. */}
                    <span className="flex items-center gap-0.5 text-[11px] font-medium text-green-700">
                      <BadgeCheck className="size-3.5" />
                      Verified Buyer
                    </span>
                  </div>
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
