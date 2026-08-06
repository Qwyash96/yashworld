import "server-only"
import type { IntegrationCategory, IntegrationEnvironment, IntegrationHealth } from "@/types/integrations"

export interface CredentialFieldDef {
  key: string
  label: string
  type: "text" | "password" | "url"
  required: boolean
  placeholder?: string
}

export interface SettingFieldDef {
  key: string
  label: string
  type: "boolean" | "select" | "number" | "text"
  options?: { value: string; label: string }[]
  default: unknown
  helpText?: string
}

export interface VerifyResult {
  ok: boolean
  message: string
  health: IntegrationHealth
}

export interface TestResult {
  ok: boolean
  message: string
  detail?: Record<string, unknown>
}

export interface WebhookResult {
  ok: boolean
  status: number
  message: string
}

/** The one buyer-facing instrument vocabulary — platformSettings/paymentMethods
 * (types/platform-settings.ts) controls which of these the storefront offers
 * at all; a payment adapter's createPaymentOrder scopes its own request/
 * widget to just the one the customer already picked, where the gateway's
 * API supports that. */
export type PaymentInstrument = "upi" | "cards" | "netbanking" | "wallet" | "emi" | "cod"

export interface PaymentOrderInput {
  amountPaise: number
  currency: string
  /** Idempotency/receipt reference — unique per checkout attempt. */
  receiptId: string
  buyerId: string
  buyerEmail: string
  buyerPhone: string
  buyerName: string
  method: PaymentInstrument
  /** Where a redirect-based gateway (PhonePe, PayU, PayPal's approval flow) sends the browser back to after payment. Ignored by modal/embedded gateways (Razorpay, Stripe, Cashfree). */
  returnUrl: string
}

export interface PaymentOrderResult {
  /** The gateway's own order/transaction id — stored as Order.gatewayOrderId. */
  gatewayOrderId: string
  /** Opaque to the router — everything lib/payment-gateway-client.ts needs
   * to actually open this gateway's checkout. Shape is gateway-specific by
   * design (modal config, a redirect URL, form-post fields, ...). */
  clientParams: Record<string, unknown>
}

export interface PaymentVerifyInput {
  gatewayOrderId: string
  /** Gateway-specific proof-of-payment fields from its own checkout return
   * (Razorpay's payment_id+signature, Stripe's PaymentIntent id, PayPal's
   * order id to capture, PhonePe/PayU's returned transaction id/checksum). */
  payload: Record<string, string>
  /** Trusted, server-computed amount — the adapter must confirm the gateway
   * actually captured exactly this much; the client's own number is never trusted. */
  expectedAmountPaise: number
}

export interface PaymentVerifyResult {
  ok: boolean
  gatewayPaymentId: string
  status: "captured" | "pending" | "failed"
  message?: string
}

export interface RefundInput {
  /** Not every gateway refunds by the same handle — Razorpay/Stripe/PayPal
   * refund by payment/charge/capture id, Cashfree/PhonePe/PayU refund by
   * order id (PayU needs both). Both are always passed; each adapter uses
   * whichever its own refund API actually keys on. */
  gatewayOrderId: string
  gatewayPaymentId: string
  amountPaise: number
  reason?: string
}

export interface RefundResult {
  ok: boolean
  gatewayRefundId?: string
  message: string
}

export interface PaymentStatusSyncInput {
  gatewayOrderId?: string
  gatewayPaymentId?: string
}

export interface PaymentStatusSyncResult {
  status: "captured" | "pending" | "failed" | "refunded" | "unknown"
  gatewayPaymentId?: string
}

/**
 * The one contract every provider implements. The generic admin UI and the
 * generic API routes (app/api/admin/integrations/**) are driven entirely by
 * what an adapter declares here — its field list, whether it supports a
 * webhook/test action — so adding a new provider means writing one new file
 * implementing this interface and registering it in
 * lib/integrations/registry.ts. Nothing else in the framework changes.
 */
export interface IntegrationAdapter {
  id: string
  name: string
  category: IntegrationCategory
  description: string
  credentialFields: CredentialFieldDef[]
  settingFields: SettingFieldDef[]
  supportsWebhook: boolean
  supportsTest: boolean
  /** Decrypted credentials, never logged or persisted by the caller — call the real provider API and report the outcome. */
  verifyConnection(credentials: Record<string, string>, environment: IntegrationEnvironment): Promise<VerifyResult>
  /** A lightweight authenticated call ("Test API"/"Test Payment" button) — not a full live checkout round-trip. */
  testAction?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    settings: Record<string, unknown>,
  ): Promise<TestResult>
  /** The adapter is responsible for verifying the provider's own webhook signature using the supplied credentials. */
  handleWebhook?(rawBody: string, headers: Record<string, string>, credentials: Record<string, string>): Promise<WebhookResult>

  // Payment-category-only operations below — undefined on every non-payment
  // adapter. lib/payment-router.ts (the checkout-time router) is the only
  // caller; buyer-facing routes never talk to a specific adapter by name.
  /** Creates a real order/transaction with the gateway for a customer to pay. */
  createPaymentOrder?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    input: PaymentOrderInput,
  ): Promise<PaymentOrderResult>
  /** Confirms a customer's payment actually captured, for the right order, at the right amount — server-side, against the gateway's own API, never trusting the client. */
  verifyPayment?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    input: PaymentVerifyInput,
  ): Promise<PaymentVerifyResult>
  /** Refunds a previously-captured payment, full or partial. */
  refundPayment?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    input: RefundInput,
  ): Promise<RefundResult>
  /** Live status pull for a payment whose webhook may have been missed/delayed. */
  syncPaymentStatus?(
    credentials: Record<string, string>,
    environment: IntegrationEnvironment,
    input: PaymentStatusSyncInput,
  ): Promise<PaymentStatusSyncResult>
}
