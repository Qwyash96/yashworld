import type { jsPDF } from "jspdf"

/** Shared [View Document] / [Download PDF] / [Print] actions for the three
 * finance document generators (adjustment-statement.ts, refund-receipt.ts,
 * payment-receipt.ts) — each of those builds and returns a jsPDF instance
 * instead of calling .save() itself, so the same built document can be
 * downloaded, opened for viewing, or sent to print without regenerating it
 * three times. The pre-existing invoice/packing-slip/shipping-label
 * generators keep their own single-purpose .save()-on-build pattern
 * unchanged (they only ever needed a download button). */

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename)
}

export function viewPdf(doc: jsPDF): void {
  window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer")
}

export function printPdf(doc: jsPDF): void {
  const url = doc.output("bloburl")
  const win = window.open(url, "_blank", "noopener,noreferrer")
  if (!win) return
  win.addEventListener("load", () => win.print())
}
