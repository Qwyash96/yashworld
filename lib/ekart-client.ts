import "server-only"

// Ekart Logistics — unlike Shiprocket/Delhivery, Ekart doesn't publish a
// stable, self-serve public API reference; API access is provisioned
// per-merchant through their partner/enterprise onboarding, and the exact
// base host + resource paths are whatever Ekart's integration team hands
// you at that point. This client is built against the REST shape virtually
// every Indian logistics aggregator in this app already uses (API-key
// header auth, JSON create/awb/label/pickup/track/cancel endpoints) so it's
// a real, working client the moment the merchant's actual base URL and
// path names are confirmed — update the `paths` below (or the request
// shapes) against Ekart's own API docs once your integration contact
// provides them. Nothing here is a live, verified integration yet.

interface EkartOrderItemInput {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface EkartCredentials {
  apiKey: string
  merchantId: string
  baseUrl: string
}

export interface CreateEkartShipmentInput {
  orderId: string
  paymentMethod: "cod" | "razorpay"
  subTotal: number
  customerName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  items: EkartOrderItemInput[]
}

export interface EkartShipment {
  shipmentId: string
}

export interface EkartAwbAssignment {
  awbCode: string
  courierName: string
}

export interface EkartTrackingResult {
  rawStatus: string
}

export class EkartApiError extends Error {}

async function ekartFetch(
  credentials: EkartCredentials,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<Record<string, unknown>> {
  const base = credentials.baseUrl.replace(/\/$/, "")
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "X-Merchant-Id": credentials.merchantId,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new EkartApiError((body?.message as string) ?? `Ekart returned ${response.status}.`)
  }
  return body
}

/** Creates the shipment on Ekart's side. Field names follow the aggregator-standard shape used across this app's other courier clients — confirm against Ekart's actual docs. */
export async function createEkartShipment(
  credentials: EkartCredentials,
  input: CreateEkartShipmentInput,
): Promise<EkartShipment> {
  const body = {
    order_id: input.orderId,
    payment_mode: input.paymentMethod === "cod" ? "COD" : "PREPAID",
    order_amount: input.subTotal,
    consignee: {
      name: input.customerName,
      phone: input.phone,
      email: input.email,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 ?? "",
      city: input.city,
      state: input.state,
      pincode: input.postalCode,
      country: "India",
    },
    items: input.items.map((item) => ({
      sku: item.productId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    weight_kg: Math.max(0.5, input.items.reduce((sum, i) => sum + i.quantity, 0) * 0.5),
  }
  const result = await ekartFetch(credentials, "/v1/shipments", { method: "POST", body })
  const shipmentId = (result.shipment_id ?? result.id) as string | undefined
  if (!shipmentId) throw new EkartApiError((result.message as string) ?? "Ekart did not return a shipment id.")
  return { shipmentId }
}

/** Assigns an AWB to an already-created shipment. */
export async function assignEkartAwb(credentials: EkartCredentials, shipmentId: string): Promise<EkartAwbAssignment> {
  const result = await ekartFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/awb`, { method: "POST", body: {} })
  const awbCode = (result.awb ?? result.awb_code) as string | undefined
  if (!awbCode) throw new EkartApiError((result.message as string) ?? "Ekart did not return an AWB code.")
  return { awbCode, courierName: "Ekart Logistics" }
}

/** Fetches the shipping label document (base64 PDF/PNG per Ekart's response). */
export async function fetchEkartLabel(credentials: EkartCredentials, shipmentId: string): Promise<string> {
  const result = await ekartFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/label`)
  const label = (result.label ?? result.label_url) as string | undefined
  if (!label) throw new EkartApiError("Ekart did not return a label.")
  return label
}

/** Schedules a pickup for the shipment. */
export async function requestEkartPickup(credentials: EkartCredentials, shipmentId: string, pickupDate: string): Promise<void> {
  await ekartFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/pickup`, {
    method: "POST",
    body: { pickup_date: pickupDate },
  })
}

/** Live tracking lookup by AWB. */
export async function trackEkartAwb(credentials: EkartCredentials, awbCode: string): Promise<EkartTrackingResult> {
  const result = await ekartFetch(credentials, `/v1/track/${encodeURIComponent(awbCode)}`)
  const rawStatus = (result.status ?? result.current_status) as string | undefined
  if (!rawStatus) throw new EkartApiError("Ekart has no tracking status for this AWB yet.")
  return { rawStatus }
}

/** Cancels a shipment before it's picked up. */
export async function cancelEkartShipment(credentials: EkartCredentials, shipmentId: string): Promise<void> {
  await ekartFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/cancel`, { method: "POST", body: {} })
}

/** Maps Ekart's free-text status onto this app's OrderStatus pipeline. Unrecognized/earlier statuses return null (no transition). */
export function mapEkartStatusToOrderStatus(rawStatus: string): "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered" | null {
  const normalized = rawStatus.toUpperCase()
  if (normalized.includes("DELIVERED")) return "Delivered"
  if (normalized.includes("OUT FOR DELIVERY")) return "Out For Delivery"
  if (normalized.includes("IN TRANSIT") || normalized.includes("SHIPPED")) return "In Transit"
  if (normalized.includes("PICKED UP") || normalized.includes("PICKUP")) return "Picked Up"
  return null
}
