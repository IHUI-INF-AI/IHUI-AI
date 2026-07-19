export interface ApiLog {
  id: string
  userId: string | null
  method: string
  path: string
  statusCode: number
  duration: number
  ip: string | null
  userAgent: string | null
  error: string | null
  createdAt: string
}

export interface LogsData {
  list: ApiLog[]
  total: number
  page: number
  pageSize: number
}

export interface LogStats {
  total: number
  byStatus: { statusCode: number; count: number }[]
  avgDuration: number
}
