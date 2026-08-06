import "server-only"
import type { PaymentMethod } from "@/types/order"

// Shift Logistics — no stable, publicly-documented API reference was
// available to build this against, unlike Shiprocket/Delhivery/Amazon
// Shipping. Same approach as lib/ekart-client.ts: a real, working REST
// client against the API-key-header + JSON create/awb/label/pickup/track/
// cancel shape this app's other courier clients already use, with a
// configurable base URL so it starts working the moment your Shift
// Logistics integration contact provides the real host and confirms these
// resource paths/payload field names. Nothing here is a live, verified
// integration yet — treat every endpoint path below as a placeholder.

interface ShiftLogisticsOrderItemInput {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface ShiftLogisticsCredentials {
  apiKey: string
  apiSecret: string
  baseUrl: string
}

export interface CreateShiftLogisticsShipmentInput {
  orderId: string
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
  items: ShiftLogisticsOrderItemInput[]
}

export interface ShiftLogisticsShipment {
  shipmentId: string
}

export interface ShiftLogisticsAwbAssignment {
  awbCode: string
  courierName: string
}

export interface ShiftLogisticsTrackingResult {
  rawStatus: string
}

export class ShiftLogisticsApiError extends Error {}

async function shiftFetch(
  credentials: ShiftLogisticsCredentials,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<Record<string, unknown>> {
  const base = credentials.baseUrl.replace(/\/$/, "")
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers: {
      "X-Api-Key": credentials.apiKey,
      "X-Api-Secret": credentials.apiSecret,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ShiftLogisticsApiError((body?.message as string) ?? `Shift Logistics returned ${response.status}.`)
  }
  return body
}

/** Creates the shipment on Shift Logistics' side. */
export async function createShiftLogisticsShipment(
  credentials: ShiftLogisticsCredentials,
  input: CreateShiftLogisticsShipmentInput,
): Promise<ShiftLogisticsShipment> {
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
  const result = await shiftFetch(credentials, "/v1/shipments", { method: "POST", body })
  const shipmentId = (result.shipment_id ?? result.id) as string | undefined
  if (!shipmentId) throw new ShiftLogisticsApiError((result.message as string) ?? "Shift Logistics did not return a shipment id.")
  return { shipmentId }
}

/** Assigns an AWB to an already-created shipment. */
export async function assignShiftLogisticsAwb(credentials: ShiftLogisticsCredentials, shipmentId: string): Promise<ShiftLogisticsAwbAssignment> {
  const result = await shiftFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/awb`, { method: "POST", body: {} })
  const awbCode = (result.awb ?? result.awb_code) as string | undefined
  if (!awbCode) throw new ShiftLogisticsApiError((result.message as string) ?? "Shift Logistics did not return an AWB code.")
  return { awbCode, courierName: "Shift Logistics" }
}

/** Fetches the shipping label document (base64 PDF/PNG per Shift Logistics' response). */
export async function fetchShiftLogisticsLabel(credentials: ShiftLogisticsCredentials, shipmentId: string): Promise<string> {
  const result = await shiftFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/label`)
  const label = (result.label ?? result.label_url) as string | undefined
  if (!label) throw new ShiftLogisticsApiError("Shift Logistics did not return a label.")
  return label
}

/** Schedules a pickup for the shipment. */
export async function requestShiftLogisticsPickup(credentials: ShiftLogisticsCredentials, shipmentId: string, pickupDate: string): Promise<void> {
  await shiftFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/pickup`, {
    method: "POST",
    body: { pickup_date: pickupDate },
  })
}

/** Live tracking lookup by AWB. */
export async function trackShiftLogisticsAwb(credentials: ShiftLogisticsCredentials, awbCode: string): Promise<ShiftLogisticsTrackingResult> {
  const result = await shiftFetch(credentials, `/v1/track/${encodeURIComponent(awbCode)}`)
  const rawStatus = (result.status ?? result.current_status) as string | undefined
  if (!rawStatus) throw new ShiftLogisticsApiError("Shift Logistics has no tracking status for this AWB yet.")
  return { rawStatus }
}

/** Cancels a shipment before it's picked up. */
export async function cancelShiftLogisticsShipment(credentials: ShiftLogisticsCredentials, shipmentId: string): Promise<void> {
  await shiftFetch(credentials, `/v1/shipments/${encodeURIComponent(shipmentId)}/cancel`, { method: "POST", body: {} })
}

/** Maps Shift Logistics' free-text status onto this app's OrderStatus pipeline. Unrecognized/earlier statuses return null (no transition). */
export function mapShiftLogisticsStatusToOrderStatus(rawStatus: string): "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered" | null {
  const normalized = rawStatus.toUpperCase()
  if (normalized.includes("DELIVERED")) return "Delivered"
  if (normalized.includes("OUT FOR DELIVERY")) return "Out For Delivery"
  if (normalized.includes("IN TRANSIT") || normalized.includes("SHIPPED")) return "In Transit"
  if (normalized.includes("PICKED UP") || normalized.includes("PICKUP")) return "Picked Up"
  return null
}
