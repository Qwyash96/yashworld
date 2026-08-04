export type SellerApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resubmission_requested"
  | "suspended"
  | "banned"

export interface PayoutInfo {
  accountHolder: string
  bankName: string
  accountNumber: string
  ifsc: string
}

export interface SellerKycDocs {
  aadhaarFrontPath?: string
  aadhaarBackPath?: string
  panPath?: string
  selfiePath?: string
  bankProofPath?: string
  gstPath?: string
  submittedAt: string
}

/** One admin decision on an application — approve/reject/request-reupload/suspend/ban/reactivate. */
export interface SellerModerationEvent {
  action: "approved" | "rejected" | "resubmission_requested" | "suspended" | "banned" | "reactivated"
  reason?: string
  byUid: string
  at: string
}

/**
 * Firestore `sellerApplications/{uid}` — private KYC application data.
 * Readable only by the owner or an admin with seller_management permission
 * (see firestore.rules `canManageSellers()`). Source of truth for the
 * approval workflow; `sellers/{uid}` is a public mirror created on approval.
 */
export interface SellerApplication {
  uid: string
  fullName: string
  mobile: string
  mobileVerified: boolean
  mobileVerifiedAt?: string
  panNumber: string
  aadhaarNumber: string
  shopName: string
  businessType: string
  address: string
  city: string
  state: string
  pincode: string
  payoutInfo: PayoutInfo
  /** True when payoutInfo.accountHolder doesn't match fullName — surfaced to admin, doesn't block submission. */
  accountHolderNameMismatch?: boolean
  kyc: SellerKycDocs
  status: SellerApplicationStatus
  sellerId?: string
  /** Reason for the current non-approved status — set by reject/request-reupload/suspend/ban. */
  rejectionReason?: string
  moderationHistory?: SellerModerationEvent[]
  createdAt: string
  updatedAt: string
}

export type SellerApplicationInput = Omit<
  SellerApplication,
  "status" | "sellerId" | "rejectionReason" | "moderationHistory" | "createdAt" | "updatedAt" | "kyc"
>

/**
 * Firestore `sellers/{uid}` — public storefront profile. Only ever written
 * by the admin approval route (Admin SDK); clients cannot write it.
 */
export interface Seller {
  uid: string
  shopName: string
  status: "approved" | "suspended" | "banned"
  sellerId: string
  ratingAvg: number
  ratingCount: number
  createdAt: string
}
