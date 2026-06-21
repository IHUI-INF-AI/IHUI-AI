export interface ApiResponse<T = unknown> {
  code: number
  msg?: string
  message?: string
  data?: T
  success?: boolean
  timestamp?: number
  traceId?: string
}

export interface ApiErrorResponse {
  code: number
  msg?: string
  message?: string
  errors?: Array<{
    field?: string
    message: string
  }>
  timestamp?: number
  traceId?: string
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AITool {
  id: string
  name: string
  description: string
  category: string
  icon?: string
  enabled: boolean
  usageCount?: number
  rating?: number
  createTime?: string
  updateTime?: string
}

export interface Order {
  id: string
  orderNo: string
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded'
  type: 'vip' | 'tool' | 'commission'
  createTime?: string
  updateTime?: string
}

export interface VIPPackage {
  id: string
  name: string
  level: 'bronze' | 'silver' | 'gold' | 'platinum'
  price: number
  duration: number
  features: string[]
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export interface CommissionStats {
  totalCommission: number
  pendingCommission: number
  withdrawnAmount: number
  commissionRate: number
  totalOrders: number
  completedOrders: number
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  notifications?: {
    email: boolean
    sms: boolean
    push: boolean
  }
  privacy?: {
    profileVisible: boolean
    activityVisible: boolean
  }
  preferences?: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    autoSave: boolean
  }
}

export interface Demand {
  id: string
  title: string
  description: string
  category: string
  status: 'open' | 'in_progress' | 'completed' | 'closed'
  userId: string
  budget?: number
  createTime?: string
  updateTime?: string
}

export interface DeveloperInfo {
  id: string
  userId: string
  name: string
  email: string
  phone?: string
  bio?: string
  avatar?: string
  verified: boolean
  rating?: number
  totalProjects?: number
  completedProjects?: number
  createTime?: string
  updateTime?: string
}

export interface DeveloperApp {
  id: string
  developerId: string
  name: string
  description?: string
  apiKey: string
  apiSecret: string
  status: 'active' | 'suspended' | 'deleted'
  rateLimit?: {
    requests: number
    period: string
  }
  callCount?: number
  createTime?: string
  updateTime?: string
}

export interface DeveloperEarning {
  appId: string
  appName: string
  totalEarnings: number
  pendingEarnings: number
  withdrawnEarnings: number
  callCount: number
  period: string
}

export enum BusinessErrorCode {
  AUTH_REQUIRED = 10001,
  AUTH_EXPIRED = 10002,
  AUTH_PERMISSION_DENIED = 10003,
  RESOURCE_NOT_FOUND = 20001,
  RESOURCE_ALREADY_EXISTS = 20002,
  RESOURCE_CONFLICT = 20003,
  VALIDATION_ERROR = 30001,
  PARAMETER_MISSING = 30002,
  PARAMETER_INVALID = 30003,
  RATE_LIMIT_EXCEEDED = 40001,
  INTERNAL_ERROR = 50001,
  SERVICE_UNAVAILABLE = 50002,
}
