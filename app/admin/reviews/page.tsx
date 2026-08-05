"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { MessageSquareText, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getAllReviews } from "@/services/review.service"
import { deleteReview } from "@/lib/reviews-client"
import { ReviewStars } from "@/components/reviews/review-stars"
import { Button } from "@/components/ui/button"
import type { Review } from "@/types/review"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[] | "loading">("loading")

  function refresh() {
    getAllReviews()
      .then(setReviews)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load reviews."))
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDelete(review: Review) {
    if (!window.confirm(`Delete this review by ${review.buyerName}? This cannot be undone.`)) return
    const result = await deleteReview(review.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Review deleted.")
    setReviews((prev) => (prev === "loading" ? prev : prev.filter((r) => r.id !== review.id)))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <MessageSquareText className="size-6 text-green-700" />
        <h1 className="text-2xl font-bold text-black">Reviews</h1>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every product review submitted across the marketplace.</p>

      <div className="mt-6 flex flex-col gap-4">
        {reviews === "loading" && <p className="text-sm text-[#444444]">Loading reviews...</p>}

        {reviews !== "loading" && reviews.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-[#f3f5f2] p-10 text-center text-sm text-[#444444]">
            No reviews yet.
          </p>
        )}

        {reviews !== "loading" &&
          reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#444444]">
                    Product: {review.productId}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-black">{review.buyerName}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <ReviewStars rating={review.rating} size="sm" />
                    <span className="text-xs text-[#444444]">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
                <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDelete(review)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>

              {review.text && <p className="mt-3 text-sm text-black">{review.text}</p>}

              {review.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative size-16 overflow-hidden rounded-lg border border-border">
                      <Image src={url} alt="Review photo" fill className="object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {review.sellerReply && (
                <div className="mt-3 rounded-lg bg-[#f3f5f2] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#444444]">Seller Response</p>
                  <p className="mt-1 text-sm text-black">{review.sellerReply}</p>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
