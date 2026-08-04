export interface DashboardChartPoint {
  date: string
  revenue: number
  orders: number
}

export interface RecentRegistration {
  uid: string
  name: string
  email: string
  role: string
  createdAt: string
}

export interface RecentOrderSummary {
  id: string
  buyerId: string
  contactEmail: string
  total: number
  createdAt: string
}

export interface RecentTicketSummary {
  id: string
  subject: string
  status: string
  createdAt: string
}

export interface LowStockProduct {
  id: string
  name: string
  stock: number
  sellerId: string
}

export interface TopSellingProduct {
  id: string
  name: string
  unitsSold: number
  price: number
}

/** One-shot response from app/api/admin/dashboard/stats — the aggregate/
 * bounded-fetch tiles the hybrid strategy refreshes on a timer. Recent
 * Orders/Registrations/Online Users are separate LIVE listeners on the
 * client, not part of this payload. */
export interface DashboardStats {
  totalBuyers: number
  totalSellers: number
  pendingSellerApprovals: number
  newUsersToday: number
  activeUsersToday: number
  ordersToday: number
  revenueToday: number
  monthlyRevenue: number
  pendingWithdrawalsCount: number
  pendingWithdrawalsAmount: number
  recentSupportTickets: RecentTicketSummary[]
  lowStockProducts: LowStockProduct[]
  topSellingProducts: TopSellingProduct[]
  revenueChart: DashboardChartPoint[]
}
