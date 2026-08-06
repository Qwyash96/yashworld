import "server-only"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"
import {
  createShiprocketShipment,
  assignShiprocketAwb,
  trackShiprocketAwb,
  cancelShiprocketShipment,
  mapShiprocketStatusToOrderStatus,
} from "@/lib/shiprocket-client"
import {
  createAmazonShipment,
  assignAmazonAwb,
  requestAmazonPickup,
  trackAmazonShipment,
  cancelAmazonShipment,
  mapAmazonStatusToOrderStatus,
  type AmazonShippingCredentials,
} from "@/lib/amazon-shipping-client"
import {
  createEkartShipment,
  assignEkartAwb,
  requestEkartPickup,
  trackEkartAwb,
  cancelEkartShipment,
  mapEkartStatusToOrderStatus,
  type EkartCredentials,
} from "@/lib/ekart-client"
import {
  createShiftLogisticsShipment,
  assignShiftLogisticsAwb,
  requestShiftLogisticsPickup,
  trackShiftLogisticsAwb,
  cancelShiftLogisticsShipment,
  mapShiftLogisticsStatusToOrderStatus,
  type ShiftLogisticsCredentials,
} from "@/lib/shift-logistics-client"
import type { OrderStatus, PaymentMethod } from "@/types/order"

/**
 * The common shipping interface — every auto-AWB-capable courier
 * implements this shape, so callers (the auto-AWB dispatcher below, the
 * seller's "Sync Tracking" route, a future cancel action) work against one
 * interface instead of branching per provider. Adding a new courier here
 * means writing its own lib/{provider}-client.ts (real HTTP calls, matching
 * lib/shiprocket-client.ts's pattern) plus one adapter object below that
 * maps this shape onto that client's own function signatures — nothing
 * else changes.
 *
 * Shiprocket's own client (lib/shiprocket-client.ts) is intentionally
 * untouched — SHIPPING_PROVIDERS.shiprocket below is a thin wrapper around
 * it, so existing Shiprocket behavior is unchanged by this file's existence.
 */
export type ShippingProviderId = "shiprocket" | "amazon-shipping" | "ekart" | "shift-logistics"

export interface CommonOrderItemInput {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface CommonShipmentInput {
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
  items: CommonOrderItemInput[]
  /** The courier-registered pickup/ship-from location nickname (each adapter's own `pickupLocationName` setting). */
  pickupLocationName: string
}

export interface CommonShipment {
  /** The provider's own internal shipment id — stored as SellerOrder.providerShipmentId. */
  shipmentId: string
  /** Overflow for a provider that needs a second internal id for some operations (e.g. Shiprocket's cancel endpoint takes its order id, not its shipment id) — not every provider needs this. */
  secondaryId?: string
}

export interface CommonAwbAssignment {
  awbCode: string
  courierName: string
}

export interface CommonTrackingResult {
  rawStatus: string
  mappedStatus: Extract<OrderStatus, "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered"> | null
}

export interface ShippingProviderAdapter {
  displayName: string
  createShipment(credentials: Record<string, string>, input: CommonShipmentInput): Promise<CommonShipment>
  assignAwb(credentials: Record<string, string>, shipment: CommonShipment): Promise<CommonAwbAssignment>
  /** Not every provider needs a separate pickup call (some assign a pickup slot as part of AWB assignment) — omit when there's nothing more to do. */
  requestPickup?(credentials: Record<string, string>, shipment: CommonShipment, pickupDate?: string): Promise<void>
  trackShipment(credentials: Record<string, string>, awbCode: string): Promise<CommonTrackingResult>
  cancelShipment(credentials: Record<string, string>, shipment: CommonShipment): Promise<void>
}

const SHIPPING_PROVIDERS: Record<ShippingProviderId, ShippingProviderAdapter> = {
  shiprocket: {
    displayName: "Shiprocket",
    async createShipment(credentials, input) {
      const shipment = await createShiprocketShipment(credentials as { email: string; password: string }, {
        orderId: input.orderId,
        pickupLocationName: input.pickupLocationName,
        paymentMethod: input.paymentMethod,
        subTotal: input.subTotal,
        customerName: input.customerName,
        phone: input.phone,
        email: input.email,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        items: input.items,
      })
      // secondaryId carries Shiprocket's order id (distinct from its shipment
      // id) — needed later for cancelShipment, which operates on the order
      // id, not the shipment id assignAwb below uses.
      return { shipmentId: String(shipment.shipmentId), secondaryId: String(shipment.shiprocketOrderId) }
    },
    async assignAwb(credentials, shipment) {
      return assignShiprocketAwb(credentials as { email: string; password: string }, Number(shipment.shipmentId))
    },
    async trackShipment(credentials, awbCode) {
      const result = await trackShiprocketAwb(credentials as { email: string; password: string }, awbCode)
      return { rawStatus: result.rawStatus, mappedStatus: mapShiprocketStatusToOrderStatus(result.rawStatus) }
    },
    async cancelShipment(credentials, shipment) {
      if (!shipment.secondaryId) throw new Error("Missing Shiprocket order id — cannot cancel this shipment.")
      await cancelShiprocketShipment(credentials as { email: string; password: string }, Number(shipment.secondaryId))
    },
  },
  "amazon-shipping": {
    displayName: "Amazon Shipping",
    async createShipment(credentials, input) {
      const shipment = await createAmazonShipment(credentials as unknown as AmazonShippingCredentials, {
        orderId: input.orderId,
        customerName: input.customerName,
        phone: input.phone,
        email: input.email,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        items: input.items,
      })
      return { shipmentId: shipment.shipmentId }
    },
    async assignAwb(credentials, shipment) {
      const awb = await assignAmazonAwb(credentials as unknown as AmazonShippingCredentials, shipment.shipmentId)
      return { awbCode: awb.trackingId, courierName: awb.carrierName }
    },
    async requestPickup(credentials, shipment, pickupDate) {
      await requestAmazonPickup(credentials as unknown as AmazonShippingCredentials, shipment.shipmentId, pickupDate ?? new Date().toISOString().slice(0, 10))
    },
    async trackShipment(credentials, awbCode) {
      const result = await trackAmazonShipment(credentials as unknown as AmazonShippingCredentials, awbCode)
      return { rawStatus: result.rawStatus, mappedStatus: mapAmazonStatusToOrderStatus(result.rawStatus) }
    },
    async cancelShipment(credentials, shipment) {
      await cancelAmazonShipment(credentials as unknown as AmazonShippingCredentials, shipment.shipmentId)
    },
  },
  ekart: {
    displayName: "Ekart Logistics",
    async createShipment(credentials, input) {
      const shipment = await createEkartShipment(credentials as unknown as EkartCredentials, input)
      return { shipmentId: shipment.shipmentId }
    },
    async assignAwb(credentials, shipment) {
      return assignEkartAwb(credentials as unknown as EkartCredentials, shipment.shipmentId)
    },
    async requestPickup(credentials, shipment, pickupDate) {
      await requestEkartPickup(credentials as unknown as EkartCredentials, shipment.shipmentId, pickupDate ?? new Date().toISOString().slice(0, 10))
    },
    async trackShipment(credentials, awbCode) {
      const result = await trackEkartAwb(credentials as unknown as EkartCredentials, awbCode)
      return { rawStatus: result.rawStatus, mappedStatus: mapEkartStatusToOrderStatus(result.rawStatus) }
    },
    async cancelShipment(credentials, shipment) {
      await cancelEkartShipment(credentials as unknown as EkartCredentials, shipment.shipmentId)
    },
  },
  "shift-logistics": {
    displayName: "Shift Logistics",
    async createShipment(credentials, input) {
      const shipment = await createShiftLogisticsShipment(credentials as unknown as ShiftLogisticsCredentials, input)
      return { shipmentId: shipment.shipmentId }
    },
    async assignAwb(credentials, shipment) {
      return assignShiftLogisticsAwb(credentials as unknown as ShiftLogisticsCredentials, shipment.shipmentId)
    },
    async requestPickup(credentials, shipment, pickupDate) {
      await requestShiftLogisticsPickup(credentials as unknown as ShiftLogisticsCredentials, shipment.shipmentId, pickupDate ?? new Date().toISOString().slice(0, 10))
    },
    async trackShipment(credentials, awbCode) {
      const result = await trackShiftLogisticsAwb(credentials as unknown as ShiftLogisticsCredentials, awbCode)
      return { rawStatus: result.rawStatus, mappedStatus: mapShiftLogisticsStatusToOrderStatus(result.rawStatus) }
    },
    async cancelShipment(credentials, shipment) {
      await cancelShiftLogisticsShipment(credentials as unknown as ShiftLogisticsCredentials, shipment.shipmentId)
    },
  },
}

/** Registration order is the tie-break when two providers are both enabled with Auto AWB on (lowest `priority` wins, same convention app/admin/integrations/** already uses for payment gateways; unset priority sorts last). */
const AUTO_AWB_CANDIDATE_ORDER: ShippingProviderId[] = ["shiprocket", "amazon-shipping", "ekart", "shift-logistics"]

export interface AutoAwbResult {
  shippingProvider: ShippingProviderId
  providerShipmentId: string
  courierPartner: string
  trackingNumber: string
}

/**
 * Finds whichever shipping provider is enabled with Auto AWB Generation on
 * (lowest `priority` first), creates the shipment and assigns a real AWB
 * through that provider's own API, and returns the result in the same
 * shape app/api/seller/orders/[id]/status has always used — this function
 * is a drop-in replacement for that route's old Shiprocket-only
 * tryAutoGenerateAwb, so existing Shiprocket sellers see no behavior
 * change. Returns null when no shipping provider currently has Auto AWB
 * enabled, exactly like the old function did.
 */
export async function tryAutoGenerateAwb(input: CommonShipmentInput): Promise<AutoAwbResult | null> {
  const configs = await Promise.all(AUTO_AWB_CANDIDATE_ORDER.map((id) => getIntegrationConfig(id)))
  const candidates = AUTO_AWB_CANDIDATE_ORDER.map((id, i) => ({ id, config: configs[i] }))
    .filter(({ config }) => config.enabled && (config.settings as { autoAwb?: boolean }).autoAwb)
    .sort((a, b) => (a.config.priority ?? Infinity) - (b.config.priority ?? Infinity))

  const chosen = candidates[0]
  if (!chosen) return null

  const provider = SHIPPING_PROVIDERS[chosen.id]
  const settings = chosen.config.settings as { pickupLocationName?: string }
  if (!settings.pickupLocationName?.trim() && chosen.id !== "shiprocket") {
    throw new Error(`Auto AWB is on for ${provider.displayName}, but no pickup location is set. Fix this in Admin → Integrations → ${provider.displayName}.`)
  }

  const credentials = await getDecryptedCredentials(chosen.id)
  const shipment = await provider.createShipment(credentials, { ...input, pickupLocationName: settings.pickupLocationName ?? input.pickupLocationName })
  const awb = await provider.assignAwb(credentials, shipment)
  if (provider.requestPickup) {
    await provider.requestPickup(credentials, shipment)
  }

  return {
    shippingProvider: chosen.id,
    providerShipmentId: encodeShipmentRef(shipment),
    courierPartner: `${awb.courierName} (${provider.displayName})`,
    trackingNumber: awb.awbCode,
  }
}

// SellerOrder.providerShipmentId is one string field, but a provider's
// CommonShipment can carry a secondaryId (Shiprocket's cancel-by-order-id
// case) — encoded as "shipmentId::secondaryId" so it round-trips through
// Firestore without a second schema field. "::" is never itself part of a
// real provider id.
function encodeShipmentRef(shipment: CommonShipment): string {
  return shipment.secondaryId ? `${shipment.shipmentId}::${shipment.secondaryId}` : shipment.shipmentId
}

function decodeShipmentRef(providerShipmentId: string): CommonShipment {
  const [shipmentId, secondaryId] = providerShipmentId.split("::")
  return { shipmentId: shipmentId!, ...(secondaryId ? { secondaryId } : {}) }
}

/** Live tracking pull for an order already shipped through one of these providers' Auto AWB flow — used by the seller's "Sync Tracking" action. */
export async function trackShipment(shippingProvider: ShippingProviderId, awbCode: string): Promise<CommonTrackingResult> {
  const provider = SHIPPING_PROVIDERS[shippingProvider]
  const credentials = await getDecryptedCredentials(shippingProvider)
  return provider.trackShipment(credentials, awbCode)
}

/** Cancels a shipment created through one of these providers' Auto AWB flow. `providerShipmentId` is SellerOrder.providerShipmentId, exactly as stored. */
export async function cancelShipment(shippingProvider: ShippingProviderId, providerShipmentId: string): Promise<void> {
  const provider = SHIPPING_PROVIDERS[shippingProvider]
  const credentials = await getDecryptedCredentials(shippingProvider)
  await provider.cancelShipment(credentials, decodeShipmentRef(providerShipmentId))
}

export function getShippingProviderDisplayName(shippingProvider: ShippingProviderId): string {
  return SHIPPING_PROVIDERS[shippingProvider].displayName
}
