import "server-only"
import type { PaymentMethod } from "@/types/order"

const BASE_URL = "https://apiv2.shiprocket.in/v1/external"

interface ShiprocketOrderItemInput {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface CreateShiprocketShipmentInput {
  orderId: string
  pickupLocationName: string
  paymentMethod: PaymentMethod
  subTotal: number
  customerName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  items: ShiprocketOrderItemInput[]
}

export interface ShiprocketShipment {
  shipmentId: number
  shiprocketOrderId: number
}

export interface ShiprocketAwbAssignment {
  awbCode: string
  courierName: string
}

export interface ShiprocketTrackingResult {
  /** Shiprocket's own free-text status (e.g. "IN TRANSIT", "OUT FOR DELIVERY") — kept for the timeline note. */
  rawStatus: string
}

export interface ShiprocketPickupResult {
  /** Split from Shiprocket's own "YYYY-MM-DD HH:mm:ss"-shaped `pickup_scheduled_date` — only set when that field is actually present in the response, never invented. */
  pickupDate?: string
  pickupTime?: string
  confirmed: boolean
}

export interface ShiprocketLabelResult {
  labelUrl?: string
}

class ShiprocketApiError extends Error {}

// Shiprocket's login token is valid for 240 hours; caching per email avoids a
// fresh login on every single AWB/tracking call. Not persisted anywhere —
// an in-memory cache is fine to lose on a cold start, it just re-logs in.
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getToken(email: string, password: string): Promise<string> {
  const cached = tokenCache.get(email)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.token) {
    throw new ShiprocketApiError(body?.message ?? "Shiprocket login failed.")
  }
  // Cache for 230 hours — a 10-hour margin under the real 240-hour token lifetime.
  tokenCache.set(email, { token: body.token, expiresAt: Date.now() + 230 * 60 * 60 * 1000 })
  return body.token as string
}

async function shiprocketFetch(
  path: string,
  token: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ShiprocketApiError(
      (body?.message as string) ?? (body?.errors ? JSON.stringify(body.errors) : `Shiprocket returned ${response.status}.`),
    )
  }
  return body
}

/**
 * Creates the shipment on Shiprocket's side ("adhoc" order — this app is the
 * source of truth for the order, Shiprocket just needs a copy to ship it).
 * Package weight/dimensions aren't tracked per-product yet (see
 * types/product.ts), so this ships with a conservative flat default rather
 * than blocking on data the seller dashboard doesn't collect — good enough
 * for rate-agnostic AWB assignment, not for precise freight billing.
 */
export async function createShiprocketShipment(
  credentials: { email: string; password: string },
  input: CreateShiprocketShipmentInput,
): Promise<ShiprocketShipment> {
  const token = await getToken(credentials.email, credentials.password)
  const now = new Date()
  const orderDate = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`

  const body = {
    order_id: input.orderId,
    order_date: orderDate,
    pickup_location: input.pickupLocationName,
    billing_customer_name: input.customerName,
    billing_last_name: "",
    billing_address: input.addressLine1,
    billing_address_2: input.addressLine2 ?? "",
    billing_city: input.city,
    billing_pincode: input.postalCode,
    billing_state: input.state,
    billing_country: "India",
    billing_email: input.email,
    billing_phone: input.phone,
    shipping_is_billing: true,
    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.productId,
      units: item.quantity,
      selling_price: item.unitPrice,
    })),
    payment_method: input.paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total: input.subTotal,
    length: 20,
    breadth: 15,
    height: 10,
    weight: Math.max(0.5, input.items.reduce((sum, item) => sum + item.quantity, 0) * 0.5),
  }

  const result = await shiprocketFetch("/orders/create/adhoc", token, { method: "POST", body })
  const shipmentId = result.shipment_id as number | undefined
  const shiprocketOrderId = result.order_id as number | undefined
  if (!shipmentId) {
    throw new ShiprocketApiError((result.message as string) ?? "Shiprocket did not return a shipment id.")
  }
  return { shipmentId, shiprocketOrderId: shiprocketOrderId ?? 0 }
}

/** Auto-assigns Shiprocket's recommended courier (cheapest/fastest per its own ranking) and returns the AWB. */
export async function assignShiprocketAwb(
  credentials: { email: string; password: string },
  shipmentId: number,
): Promise<ShiprocketAwbAssignment> {
  const token = await getToken(credentials.email, credentials.password)
  const result = await shiprocketFetch("/courier/assign/awb", token, {
    method: "POST",
    body: { shipment_id: shipmentId },
  })
  const data = result.response as Record<string, unknown> | undefined
  const awbData = (data?.data ?? {}) as Record<string, unknown>
  const awbCode = awbData.awb_code as string | undefined
  const courierName = awbData.courier_name as string | undefined
  if (!awbCode) {
    throw new ShiprocketApiError((result.message as string) ?? "Shiprocket did not return an AWB code.")
  }
  return { awbCode, courierName: courierName ?? "Shiprocket" }
}

/**
 * Real Shiprocket "Generate Pickup" call (POST /courier/generate/pickup) —
 * asks Shiprocket to schedule a courier pickup for an already-AWB-assigned
 * shipment. Only ever returns a pickupScheduledAt when Shiprocket's own
 * response actually includes one (`response.pickup_scheduled_date`); a
 * successful call with no date in the response still returns
 * `confirmed: true` with no date, since Shiprocket accepted the pickup
 * request even though the exact slot isn't in this response — the caller
 * must not invent a date/time in that case (see CommonPickupResult's doc
 * comment in lib/shipping-service.ts).
 */
export async function generateShiprocketPickup(
  credentials: { email: string; password: string },
  shipmentId: number,
): Promise<ShiprocketPickupResult> {
  const token = await getToken(credentials.email, credentials.password)
  const result = await shiprocketFetch("/courier/generate/pickup", token, {
    method: "POST",
    body: { shipment_id: [shipmentId] },
  })
  const confirmed = result.pickup_status === 1 || result.pickup_status === true
  const response = result.response as Record<string, unknown> | undefined
  const pickupScheduledAt = response?.pickup_scheduled_date as string | undefined
  // "YYYY-MM-DD HH:mm:ss" — split rather than passing the raw string through,
  // so the caller can display date/time separately without re-parsing.
  const [pickupDate, pickupTime] = pickupScheduledAt ? pickupScheduledAt.split(" ") : [undefined, undefined]
  return { confirmed, ...(pickupDate ? { pickupDate } : {}), ...(pickupTime ? { pickupTime } : {}) }
}

/**
 * Real Shiprocket "Generate Label" call (POST /courier/generate/label) —
 * label generation is sometimes asynchronous on Shiprocket's side even
 * after a successful call, so a missing `label_url` here is a normal
 * "not ready yet" outcome, not an error; the caller shows "Generating..."
 * rather than treating this as a failure.
 */
export async function generateShiprocketLabel(
  credentials: { email: string; password: string },
  shipmentId: number,
): Promise<ShiprocketLabelResult> {
  const token = await getToken(credentials.email, credentials.password)
  const result = await shiprocketFetch("/courier/generate/label", token, {
    method: "POST",
    body: { shipment_id: [shipmentId] },
  })
  const labelUrl = result.label_url as string | undefined
  return { ...(labelUrl ? { labelUrl } : {}) }
}

/** Live tracking lookup by AWB — used by the seller's "Sync Tracking" action. */
export async function trackShiprocketAwb(
  credentials: { email: string; password: string },
  awbCode: string,
): Promise<ShiprocketTrackingResult> {
  const token = await getToken(credentials.email, credentials.password)
  const result = await shiprocketFetch(`/courier/track/awb/${encodeURIComponent(awbCode)}`, token)
  const trackingData = result.tracking_data as Record<string, unknown> | undefined
  const shipmentTrack = trackingData?.shipment_track as Record<string, unknown>[] | undefined
  const rawStatus = (shipmentTrack?.[0]?.current_status as string | undefined) ?? (trackingData?.shipment_status as string | undefined)
  if (!rawStatus) {
    throw new ShiprocketApiError("Shiprocket has no tracking status for this AWB yet.")
  }
  return { rawStatus }
}

/** Cancels a shipment by Shiprocket's internal order id (not the AWB) — used by lib/shipping-service.ts's common cancelShipment(). */
export async function cancelShiprocketShipment(
  credentials: { email: string; password: string },
  shiprocketOrderId: number,
): Promise<void> {
  const token = await getToken(credentials.email, credentials.password)
  await shiprocketFetch("/orders/cancel", token, { method: "POST", body: { ids: [shiprocketOrderId] } })
}

/** Maps Shiprocket's free-text courier status onto this app's OrderStatus pipeline. Unrecognized/earlier statuses return null (no transition). */
export function mapShiprocketStatusToOrderStatus(rawStatus: string): "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered" | null {
  const normalized = rawStatus.toUpperCase()
  if (normalized.includes("DELIVERED")) return "Delivered"
  if (normalized.includes("OUT FOR DELIVERY")) return "Out For Delivery"
  if (normalized.includes("IN TRANSIT") || normalized.includes("SHIPPED")) return "In Transit"
  if (normalized.includes("PICKED UP") || normalized.includes("PICKUP GENERATED") || normalized.includes("PICKUP SCHEDULED")) return "Picked Up"
  return null
}
