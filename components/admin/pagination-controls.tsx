import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Cursor-based pagination (Firestore has no offset/page-number queries) —
 * shared by Users, Orders, and Reports admin list pages. The caller owns a
 * stack of previous cursors so "Previous" can pop back. */
export function PaginationControls({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  loading,
}: {
  onPrevious: () => void
  onNext: () => void
  canGoPrevious: boolean
  canGoNext: boolean
  loading?: boolean
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <Button size="sm" variant="outline" className="h-9" disabled={!canGoPrevious || loading} onClick={onPrevious}>
        <ChevronLeft className="size-3.5" />
        Previous
      </Button>
      <Button size="sm" variant="outline" className="h-9" disabled={!canGoNext || loading} onClick={onNext}>
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  )
}
