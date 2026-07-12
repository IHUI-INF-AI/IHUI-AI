export interface DetailedStats {
  totals: {
    users: number
    projects: number
    files: number
    orders: number
    usersChange: number
    projectsChange: number
    filesChange: number
    ordersChange: number
  }
  userGrowth: number[]
  projectStatus: { key: string; value: number }[]
  fileTypes: { key: string; value: number }[]
  orderStats: { totalAmount: number; totalCount: number; paidCount: number; pendingCount: number }
}

interface RawDetailedStats {
  userGrowthTrend: { date: string; count: number }[]
  projectDistribution: { status: number; count: number }[]
  fileTypeDistribution: { mimeType: string; count: number }[]
  orderStats: { total: number; paid: number; pending: number; totalRevenue: number }
}

interface AdminStatsResponse {
  totalUsers: number
  totalProjects: number
  todayRevenue: number
  activeSessions: number
  totalUsersChange: number
  totalProjectsChange: number
  todayRevenueChange: number
  activeSessionsChange: number
}

export type { RawDetailedStats, AdminStatsResponse }
