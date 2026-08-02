import type { Address } from "./user"

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed"

export interface OrderItem {
  productId: string
  sellerId: string
  quantity: number
  price: number
}

/** One seller's portion of a multi-vendor order — independently fulfillable. */
export interface SellerOrder {
  sellerId: string
  items: OrderItem[]
  status: OrderStatus
}

/** Firestore `orders/{id}` document shape. */
export interface Order {
  id: string
  buyerId: string
  sellerOrders: SellerOrder[]
  status: OrderStatus
  totals: {
    subtotal: number
    shipping: number
    total: number
  }
  shippingAddress: Address
  paymentStatus: PaymentStatus
  createdAt: string
}

export type OrderInput = Omit<Order, "id" | "createdAt">
