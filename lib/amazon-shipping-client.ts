import "server-only"

// Amazon Shipping API v2 — part of the Selling Partner API (SP-API) family.
// Auth is Login With Amazon (LWA) OAuth2: exchange a long-lived refresh
// token (generated once when the seller authorizes this app in Seller
// Central) for a short-lived (~1 hour) access token, sent as the
// `x-amz-access-token` header on every call. The LWA token endpoint itself
// is stable and confirmed; the exact Shipping v2 resource paths below
// (/shipping/v2/shipments etc.) follow Amazon's published shape as of this
// writing but SP-API endpoints/regions/versions do change — confirm each
// path against https://developer-docs.amazon.com/sp-api/docs/shipping-api-v2-reference
// before enabling in production. Base endpoint is region-specific (NA/EU/FE).

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"

const REGION_ENDPOINTS: Record<string, string> = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
}

export interface AmazonShippingCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
  region: string
}

interface AmazonOrderItemInput {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface CreateAmazonShipmentInput {
  orderId: string
  customerName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  items: AmazonOrderItemInput[]
}

export interface AmazonShipment {
  shipmentId: string
}

export interface AmazonAwbAssignment {
  trackingId: string
  carrierName: string
}

export interface AmazonTrackingResult {
  rawStatus: string
}

export class AmazonShippingApiError extends Error {}

function baseUrl(region: string): string {
  return REGION_ENDPOINTS[region] ?? REGION_ENDPOINTS.na
}

// LWA access tokens are valid ~1 hour; cached per clientId+refreshToken pair
// so a burst of calls (create shipment -> assign AWB -> label) doesn't
// re-authenticate every time. In-memory only, same trade-off as
// lib/shiprocket-client.ts's token cache — fine to lose on a cold start.
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessToken(credentials: AmazonShippingCredentials): Promise<string> {
  const cacheKey = `${credentials.clientId}:${credentials.refreshToken}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const response = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new AmazonShippingApiError(body?.error_description ?? body?.error ?? "Amazon LWA token refresh failed.")
  }
  const expiresInMs = (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000
  // 5-minute safety margin under the real expiry.
  tokenCache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + expiresInMs - 5 * 60 * 1000 })
  return body.access_token as string
}

async function spApiFetch(
  credentials: AmazonShippingCredentials,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken(credentials)
  const response = await fetch(`${baseUrl(credentials.region)}${path}`, {
    method: init.method,
    headers: {
      "x-amz-access-token": accessToken,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const errors = body?.errors as { message?: string }[] | undefined
    throw new AmazonShippingApiError(errors?.[0]?.message ?? `Amazon Shipping API returned ${response.status}.`)
  }
  return body
}

/** Creates a shipment ("purchase shipping" flow) via the Shipping v2 API. */
export async function createAmazonShipment(
  credentials: AmazonShippingCredentials,
  input: CreateAmazonShipmentInput,
): Promise<AmazonShipment> {
  const body = {
    clientReferenceId: input.orderId,
    shipTo: {
      name: input.customerName,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      stateOrRegion: input.state,
      city: input.city,
      postalCode: input.postalCode,
      countryCode: "IN",
      phoneNumber: input.phone,
      email: input.email,
    },
    packages: [
      {
        weight: { unit: "KG", value: Math.max(0.5, input.items.reduce((sum, i) => sum + i.quantity, 0) * 0.5) },
        dimensions: { length: 20, width: 15, height: 10, unit: "CM" },
        items: input.items.map((item) => ({
          quantity: item.quantity,
          description: item.name,
          declaredValue: { unit: "INR", value: item.unitPrice },
        })),
      },
    ],
  }
  const result = await spApiFetch(credentials, "/shipping/v2/shipments", { method: "POST", body })
  const shipmentId = result.shipmentId as string | undefined
  if (!shipmentId) throw new AmazonShippingApiError("Amazon Shipping API did not return a shipment id.")
  return { shipmentId }
}

/** Purchases the shipping rate/label for the shipment, which is what actually assigns the tracking id. */
export async function assignAmazonAwb(
  credentials: AmazonShippingCredentials,
  shipmentId: string,
): Promise<AmazonAwbAssignment> {
  const result = await spApiFetch(credentials, `/shipping/v2/shipments/${encodeURIComponent(shipmentId)}/purchaseLabels`, {
    method: "POST",
    body: {},
  })
  const packageDocument = (result.packageDocumentDetails as Record<string, unknown>[] | undefined)?.[0]
  const trackingId = packageDocument?.trackingId as string | undefined
  const carrierName = (result.carrier as Record<string, unknown> | undefined)?.name as string | undefined
  if (!trackingId) throw new AmazonShippingApiError("Amazon Shipping API did not return a tracking id.")
  return { trackingId, carrierName: carrierName ?? "Amazon Shipping" }
}

/** Fetches the purchased label as a base64 document, per Amazon's label-retrieval endpoint. */
export async function fetchAmazonLabel(credentials: AmazonShippingCredentials, shipmentId: string): Promise<string> {
  const result = await spApiFetch(credentials, `/shipping/v2/shipments/${encodeURIComponent(shipmentId)}/documents`)
  const documents = result.documents as Record<string, unknown>[] | undefined
  const contents = documents?.[0]?.contents as string | undefined
  if (!contents) throw new AmazonShippingApiError("Amazon Shipping API did not return a label document.")
  return contents
}

/** Schedules the physical pickup for an already-labeled shipment. */
export async function requestAmazonPickup(
  credentials: AmazonShippingCredentials,
  shipmentId: string,
  pickupDate: string,
): Promise<void> {
  await spApiFetch(credentials, "/shipping/v2/pickups", {
    method: "POST",
    body: { shipmentIds: [shipmentId], pickupDate },
  })
}

/** Live tracking lookup by tracking id — used by the seller's "Sync Tracking" action. */
export async function trackAmazonShipment(
  credentials: AmazonShippingCredentials,
  trackingId: string,
): Promise<AmazonTrackingResult> {
  const result = await spApiFetch(credentials, `/shipping/v2/tracking/${encodeURIComponent(trackingId)}`)
  const summary = result.summary as Record<string, unknown> | undefined
  const rawStatus = summary?.status as string | undefined
  if (!rawStatus) throw new AmazonShippingApiError("Amazon Shipping API has no tracking status for this shipment yet.")
  return { rawStatus }
}

/** Cancels a purchased shipment (before pickup). */
export async function cancelAmazonShipment(credentials: AmazonShippingCredentials, shipmentId: string): Promise<void> {
  await spApiFetch(credentials, `/shipping/v2/shipments/${encodeURIComponent(shipmentId)}/cancel`, { method: "POST", body: {} })
}

/** Maps Amazon's tracking status onto this app's OrderStatus pipeline. Unrecognized/earlier statuses return null (no transition). */
export function mapAmazonStatusToOrderStatus(rawStatus: string): "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered" | null {
  const normalized = rawStatus.toUpperCase()
  if (normalized.includes("DELIVERED")) return "Delivered"
  if (normalized.includes("OUT_FOR_DELIVERY") || normalized.includes("OUT FOR DELIVERY")) return "Out For Delivery"
  if (normalized.includes("IN_TRANSIT") || normalized.includes("IN TRANSIT")) return "In Transit"
  if (normalized.includes("PICKED_UP") || normalized.includes("PICKED UP") || normalized.includes("PICKUP")) return "Picked Up"
  return null
}
