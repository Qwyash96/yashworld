export interface ReportDailyPoint {
  date: string
  orders: number
  revenue: number
}

export interface ReportSellerRow {
  sellerId: string
  orders: number
  revenue: number
  payout: number
}

export interface ReportProductRow {
  productId: string
  productName: string
  units: number
  revenue: number
}

export interface ReportCustomerRow {
  buyerId: string
  email: string
  orders: number
  spend: number
}

/** Response from app/api/admin/reports — ONE bounded orders-range fetch,
 * every grouping (Sales/Revenue/Sellers/Products/Customers) derived from
 * that single pass rather than 5 separate heavy queries. */
export interface ReportsData {
  from: string
  to: string
  totals: { orders: number; revenue: number; discount: number; shipping: number }
  dailySeries: ReportDailyPoint[]
  bySeller: ReportSellerRow[]
  byProduct: ReportProductRow[]
  byCustomer: ReportCustomerRow[]
}
