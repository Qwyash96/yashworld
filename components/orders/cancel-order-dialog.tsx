"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cancelOrder } from "@/services/order.service"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
  sellerId,
  onCancelled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  sellerId: string
  onCancelled: () => void
}) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (!reason.trim()) {
      toast.error("Please tell us why you're cancelling.")
      return
    }
    setSubmitting(true)
    try {
      const { refundPending } = await cancelOrder(orderId, sellerId, reason.trim())
      toast.success(refundPending ? "Order cancelled. Your refund will be processed shortly." : "Order cancelled.")
      setReason("")
      onOpenChange(false)
      onCancelled()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Cancel Order</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to cancel this order? This can&apos;t be undone.
        </p>

        <div className="mt-2 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Reason for cancellation</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Ordered by mistake, found a better price, changed my mind..."
              className="min-h-24 w-full rounded-lg border border-border bg-white p-3 text-sm text-black outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Keep Order
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Confirm Cancellation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
