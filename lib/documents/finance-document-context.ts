import { FINANCE_DOCUMENT_LABELS, type FinanceDocumentType } from "@/types/finance-document"
import type { AdjustmentType } from "@/types/finance"

export interface BusinessInfo {
  siteName: string
  supportEmail: string
  supportPhone: string
}

/** The one place every financial document generator gets Ixoflora's
 * business details from — see app/api/finance/business-info/route.ts's own
 * doc comment on why nothing beyond siteName/supportEmail/supportPhone is
 * ever included (no GST/tax field is configured anywhere in this project). */
export async function fetchBusinessInfo(): Promise<BusinessInfo> {
  const response = await fetch("/api/finance/business-info")
  if (!response.ok) return { siteName: "IXOFLORA", supportEmail: "", supportPhone: "" }
  return response.json()
}

export interface AdjustmentDocumentContext {
  business: BusinessInfo
  documentNumber: string
  documentTypeLabel: string
  createdAt: string
  orderId?: string
  partyLabel: string
  type: AdjustmentType
  amount: number
  reason: string
  notes?: string
  previousBalance: number
  newBalance: number
  createdByEmail: string
  approvedByEmail?: string
  approvedAt?: string
  status: string
}

export function adjustmentDocumentTypeLabel(type: FinanceDocumentType): string {
  return FINANCE_DOCUMENT_LABELS[type]
}

export interface RefundDocumentContext {
  business: BusinessInfo
  documentNumber: string
  createdAt: string
  orderId: string
  customerName: string
  mode: "full" | "manual"
  amount: number
  reason?: string
  eligibleAmount: number
  adjustmentAmount: number
  paymentMethod: string
  status: string
  gatewayRefundId?: string
  approvedByEmail: string
}

export interface PaymentReceiptContext {
  business: BusinessInfo
  documentNumber: string
  orderId: string
  createdAt: string
  customerName: string
  amount: number
  paymentMethod: string
  paymentStatus: string
}
