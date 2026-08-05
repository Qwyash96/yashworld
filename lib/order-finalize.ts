import "server-only"
import { createHash } from "crypto"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { getShippingRate } from "@/lib/shipping"
import { isCouponCurrentlyValid } from "@/lib/coupons"
import {
  InsufficientStockError,
  computeOrderPricing,
  computeOrderPricingFromData,
  type PricingLineInput,
} from "@/lib/pricing-engine"
import type { Address } from "@/types/user"
import type { Product } from "@/types/product"
import type { Order, PaymentMethod, PaymentStatus, SellerOrder, ShippingMethod } from "@/types/order"
import type { Coupon } from "@/types/coupon"
import type { AdminNotificationInput } from "@/types/notification"
import type { SellerNotificationInput } from "@/types/seller-notification"

// Re-exported so existing importers (app/api/payments/razorpay/create-order,
// app/api/payments/razorpay/verify) don't need to change their import path —
// the class itself now lives in lib/pricing-engine.ts, next to the stock
// check that throws it.
export { InsufficientStockError }

/** Thrown when finalizeOrder detects this exact payment/attempt already
 * created an order — a double-click, a network retry re-sending the same
 * request, or (for Razorpay) the checkout handler firing twice. Callers
 * should treat this as success, not an error: return `existingOrderId`
 * instead of the error. */
export class DuplicatePaymentError extends Error {
  constructor(public existingOrderId: string) {
    super("This payment has already been processed.")
  }
}

export interface FinalizeOrderInput {
  buyerId: string
  contactEmail: string
  items: { productId: string; quantity: number }[]
  shippingAddress: Address
  shippingMethod: ShippingMethod
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  couponCode?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
}

export interface FinalizeOrderResult {
  orderId: string
  total: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The single trusted path to creating an order. Re-reads every product,
 * the platform commission rate, and (if supplied) the coupon from Firestore
 * INSIDE one transaction (never trusts client-sent price/sellerId/discount),
 * verifies stock and coupon validity, and atomically: decrements stock,
 * increments coupon/campaign usage stats, writes the redemption record, and
 * creates the order doc. Used by both /api/checkout/cod and
 * /api/payments/razorpay/verify so COD and Razorpay orders are created
 * identically; callers decide paymentMethod/paymentStatus, this function
 * doesn't know or care which gateway was used.
 */
export async function finalizeOrder(input: FinalizeOrderInput): Promise<FinalizeOrderResult> {
  if (input.items.length === 0) {
    throw new Error("No items to order.")
  }

  const db = getAdminDb()
  const productRefs = input.items.map((item) => db.collection("products").doc(item.productId))
  const orderRef = db.collection("orders").doc()
  const commissionRef = db.collection("platformSettings").doc("commission")
  const couponCode = input.couponCode?.trim().toUpperCase()
  const couponRef = couponCode ? db.collection("coupons").doc(couponCode) : null

  // Idempotency guard against a double-submit creating two orders for one
  // real checkout attempt (double-click, a network retry re-sending the
  // same request, the Razorpay handler firing twice). Razorpay's payment id
  // is already a unique, gateway-verified key. COD has no such external id,
  // so it gets a content hash of buyer+cart+a coarse time bucket instead —
  // not a perfect guarantee (a genuine repeat order of the identical cart
  // within the window would also be caught), but it eliminates the common
  // double-click case without a new composite query/index.
  const idempotencyKey = input.razorpayPaymentId
    ? `razorpay:${input.razorpayPaymentId}`
    : `cod:${createHash("sha256")
        .update(
          [
            input.buyerId,
            ...input.items.map((i) => `${i.productId}:${i.quantity}`).sort(),
            Math.floor(Date.now() / 10_000),
          ].join("|"),
        )
        .digest("hex")}`
  const idempotencyRef = db.collection("processedPayments").doc(idempotencyKey)

  const total = await db.runTransaction(async (tx) => {
    const now = new Date()

    const [productSnaps, commissionSnap, couponSnap, idempotencySnap] = await Promise.all([
      tx.getAll(...productRefs),
      tx.get(commissionRef),
      couponRef ? tx.get(couponRef) : Promise.resolve(null),
      tx.get(idempotencyRef),
    ])

    if (idempotencySnap.exists) {
      throw new DuplicatePaymentError(idempotencySnap.data()!.orderId as string)
    }

    const lineInputs: PricingLineInput[] = []
    for (let i = 0; i < input.items.length; i++) {
      const snapshot = productSnaps[i]
      const wanted = input.items[i]
      if (!snapshot.exists) {
        throw new Error(`Product not found: ${wanted.productId}`)
      }
      const product = { id: snapshot.id, ...snapshot.data() } as Product
      if (product.stock < wanted.quantity) {
        throw new InsufficientStockError(product.name, product.stock)
      }
      lineInputs.push({ product, quantity: wanted.quantity })
    }

    // Re-validate the coupon inside the transaction — the final, atomic
    // check. A coupon that looked valid a moment ago (e.g. at Razorpay
    // create-order time) but has since expired/paused/hit its usage limit
    // is simply not applied here, exactly like a product price/stock
    // change between create-order and verify already isn't specially
    // handled today — the existing amount-match check in verify/route.ts
    // is what catches any resulting mismatch.
    let coupon: Coupon | null = null
    if (couponSnap?.exists) {
      const candidate = couponSnap.data() as Coupon
      if (isCouponCurrentlyValid(candidate, now)) {
        if (candidate.usageLimitPerBuyer !== undefined) {
          const redemptions = await tx.get(
            db
              .collection("couponRedemptions")
              .where("couponCode", "==", candidate.code)
              .where("buyerId", "==", input.buyerId),
          )
          if (redemptions.size < candidate.usageLimitPerBuyer) coupon = candidate
        } else {
          coupon = candidate
        }
      }
    }

    const commissionPercent = commissionSnap.exists
      ? (commissionSnap.data()?.defaultCommissionPercent ?? 0)
      : 0

    const pricing = computeOrderPricingFromData(lineInputs, commissionPercent, coupon, now)

    for (let i = 0; i < lineInputs.length; i++) {
      tx.update(productRefs[i], {
        stock: lineInputs[i].product.stock - lineInputs[i].quantity,
        unitsSold: FieldValue.increment(lineInputs[i].quantity),
      })
    }

    const bySeller = new Map<string, typeof pricing.items>()
    for (const item of pricing.items) {
      const existing = bySeller.get(item.sellerId) ?? []
      existing.push(item)
      bySeller.set(item.sellerId, existing)
    }
    const sellerOrders: SellerOrder[] = Array.from(bySeller.entries()).map(([sellerId, items]) => {
      const breakdown = pricing.sellerBreakdown.find((s) => s.sellerId === sellerId)!
      return {
        sellerId,
        items: items.map((item) => ({
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
          price: item.unitPrice,
          ...(item.discountSource !== "none" ? { originalPrice: item.originalUnitPrice } : {}),
          ...(item.discountSource !== "none" ? { discountSource: item.discountSource } : {}),
          ...(item.couponCode ? { couponCode: item.couponCode } : {}),
        })),
        status: "Pending" as const,
        commissionAmount: breakdown.commissionAmount,
        payoutAmount: breakdown.payoutAmount,
      }
    })
    const sellerIds = Array.from(bySeller.keys())
    const shipping = getShippingRate(input.shippingMethod, pricing.subtotal)
    const total = round2(pricing.subtotal - pricing.discount + shipping)

    if (coupon) {
      const sellerCouponDiscountAmount = pricing.items.reduce((sum: number, item) => {
        return item.discountSource === "seller_coupon"
          ? sum + (item.originalUnitPrice - item.unitPrice) * item.quantity
          : sum
      }, 0)
      const couponDiscountAmount = coupon.scope === "global" ? pricing.discount : sellerCouponDiscountAmount

      tx.update(couponRef!, {
        usedCount: FieldValue.increment(1),
        totalDiscountGiven: FieldValue.increment(couponDiscountAmount),
        totalRevenue: FieldValue.increment(pricing.subtotal),
        updatedAt: now.toISOString(),
      })
      tx.set(db.collection("couponRedemptions").doc(`${orderRef.id}_${coupon.code}`), {
        orderId: orderRef.id,
        couponCode: coupon.code,
        buyerId: input.buyerId,
        discountAmount: couponDiscountAmount,
        redeemedAt: now.toISOString(),
      })
    }

    for (const campaignId of pricing.campaignIds) {
      const campaignItems = pricing.items.filter(
        (item) => item.discountSource === "campaign" && lineInputs.find((l) => l.product.id === item.productId)?.product.campaignOffer?.campaignId === campaignId,
      )
      const revenue = campaignItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      const discountGiven = campaignItems.reduce(
        (sum, item) => sum + (item.originalUnitPrice - item.unitPrice) * item.quantity,
        0,
      )
      tx.update(db.collection("campaigns").doc(campaignId), {
        "stats.ordersCount": FieldValue.increment(1),
        "stats.revenue": FieldValue.increment(round2(revenue)),
        "stats.discountGiven": FieldValue.increment(round2(discountGiven)),
        updatedAt: now.toISOString(),
      })
    }

    const order: Omit<Order, "id"> = {
      buyerId: input.buyerId,
      contactEmail: input.contactEmail,
      sellerOrders,
      sellerIds,
      status: "Pending",
      totals: { subtotal: pricing.subtotal, discount: pricing.discount, shipping, total },
      ...(pricing.appliedCouponCode ? { appliedCouponCode: pricing.appliedCouponCode } : {}),
      ...(pricing.campaignIds.length > 0 ? { campaignIds: pricing.campaignIds } : {}),
      shippingAddress: input.shippingAddress,
      shippingMethod: input.shippingMethod,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      ...(input.razorpayOrderId ? { razorpayOrderId: input.razorpayOrderId } : {}),
      ...(input.razorpayPaymentId ? { razorpayPaymentId: input.razorpayPaymentId } : {}),
      createdAt: now.toISOString(),
    }

    tx.set(orderRef, order)
    tx.set(idempotencyRef, { orderId: orderRef.id, createdAt: now.toISOString() })

    // Admin bell notifications — written inside this same trusted
    // transaction (the only "an order was just placed/paid" choke point in
    // the app, no Cloud Functions exist anywhere) rather than a listener.
    const notifications: AdminNotificationInput[] = [
      {
        type: "order_placed",
        targetPermission: "order_management",
        title: "New order placed",
        message: `Order #${orderRef.id.slice(0, 8)} — ${round2(total)} — ${sellerIds.length} seller(s).`,
        relatedType: "order",
        relatedId: orderRef.id,
      },
    ]
    if (input.paymentMethod === "razorpay" && input.paymentStatus === "Paid") {
      notifications.push({
        type: "payment_received",
        targetPermission: "payments",
        title: "Payment received",
        message: `Razorpay payment of ${round2(total)} received for order #${orderRef.id.slice(0, 8)}.`,
        relatedType: "order",
        relatedId: orderRef.id,
      })
    }
    for (const notification of notifications) {
      tx.set(db.collection("notifications").doc(), { ...notification, createdAt: now.toISOString() })
    }

    // One per seller on this order — their own fulfillment-dashboard bell
    // (types/seller-notification.ts), distinct from the admin bell above.
    for (const sellerId of sellerIds) {
      const sellerNotification: SellerNotificationInput = {
        sellerId,
        type: "new_order",
        title: "New order received",
        message: `You have a new order — #${orderRef.id.slice(0, 8)}.`,
        relatedType: "order",
        relatedId: orderRef.id,
      }
      tx.set(db.collection("sellerNotifications").doc(), { ...sellerNotification, createdAt: now.toISOString() })
    }

    return total
  })

  return { orderId: orderRef.id, total }
}

/**
 * Read-only trusted pricing — no writes, no stock check side effects beyond
 * validation. Used by the Razorpay create-order route to know the correct
 * amount to charge before any payment has happened, and re-run identically
 * (same items/shippingMethod/couponCode) by verify's amount-match check.
 */
export async function computeTrustedTotal(
  items: { productId: string; quantity: number }[],
  shippingMethod: ShippingMethod,
  couponCode?: string,
): Promise<number> {
  if (items.length === 0) {
    throw new Error("No items to order.")
  }
  const pricing = await computeOrderPricing(items, { couponCode })
  const shipping = getShippingRate(shippingMethod, pricing.subtotal)
  return round2(pricing.subtotal - pricing.discount + shipping)
}
