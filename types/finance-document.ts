/**
 * Every financial document this system can produce, named for what it
 * actually is rather than calling everything "invoice" — see
 * lib/finance-documents.ts and lib/documents/*.ts for the generators.
 */
export type FinanceDocumentType =
  | "invoice"
  | "payment_receipt"
  | "refund_receipt"
  | "credit_note"
  | "debit_statement"
  | "credit_statement"

export const FINANCE_DOCUMENT_LABELS: Record<FinanceDocumentType, string> = {
  invoice: "Tax Invoice",
  payment_receipt: "Payment Receipt",
  refund_receipt: "Refund Receipt",
  credit_note: "Credit Note",
  debit_statement: "Debit / Adjustment Statement",
  credit_statement: "Credit / Adjustment Statement",
}

/**
 * Firestore `financeDocuments/{id}` — metadata only (document number, type,
 * who/what it's for, and what it's attached to). The PDF itself is
 * generated on demand from this metadata + the underlying order/adjustment
 * data, the same way the pre-existing invoice/packing-slip/shipping-label
 * generators already work (lib/documents/*.ts, jsPDF, client-side, no file
 * storage) — this project has no document file-storage system to extend,
 * so this doesn't invent one; it only adds the missing metadata trail
 * (document number, generatedBy, audit linkage) around the existing
 * generate-on-demand pattern.
 */
export interface FinanceDocument {
  id: string
  documentNumber: string
  type: FinanceDocumentType
  orderId?: string
  partyType: "buyer" | "seller"
  partyId: string
  /** The adjustment this document was generated for, if any (debit/credit statement, or a refund_adjustment's refund_receipt). */
  relatedAdjustmentId?: string
  /** The refund this document was generated for, if type is refund_receipt/credit_note from a RefundRequest rather than an adjustment. */
  relatedRefundId?: string
  amount: number
  generatedBy: { uid: string; email: string }
  createdAt: string
}
