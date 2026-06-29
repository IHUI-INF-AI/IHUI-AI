/**
 * API响应相关类型定义
 */

/**
 * 业务错误码枚举
 */
export enum BusinessErrorCode {
  // 认证相关错误
  AUTH_REQUIRED = 10001,
  AUTH_EXPIRED = 10002,
  AUTH_PERMISSION_DENIED = 10003,
  AUTH_INVALID_TOKEN = 10004,
  AUTH_INVALID_CREDENTIALS = 10005,

  // 资源相关错误
  RESOURCE_NOT_FOUND = 20001,
  RESOURCE_CONFLICT = 20002,
  RESOURCE_LOCKED = 20003,

  // 参数相关错误
  VALIDATION_ERROR = 30001,
  PARAMETER_MISSING = 30002,
  PARAMETER_INVALID = 30003,

  // 业务逻辑错误
  BUSINESS_ERROR = 40001,
  OPERATION_FAILED = 40002,
  LIMIT_EXCEEDED = 40003,

  // 系统相关错误
  SYSTEM_ERROR = 50001,
  SERVICE_UNAVAILABLE = 50002,
  DATABASE_ERROR = 50003,
  THIRD_PARTY_ERROR = 50004,
}

/**
 * API响应接口
 */
export interface ApiResponse<T = unknown> {
  code: number
  msg?: string
  message?: string
  data?: T
  success?: boolean
  timestamp?: number
  traceId?: string
}

/**
 * API错误响应接口
 */
export interface ApiErrorResponse extends ApiResponse<unknown> {
  code: Exclude<number, 200>
  error?: string
  details?: Record<string, unknown>
  message?: string
}

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * 分页响应接口
 * 兼容两种后端格式:
 * - 体系 A (Java/Node): { items?, list?, pagination }
 * - ruoyi 格式: { records, total, current, size }
 */
export interface PaginationResponse<T> {
  items?: T[]
  list?: T[]
  records?: T[]
  total?: number
  current?: number
  size?: number
  pagination?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * 分页结果类型别名（向后兼容）
 */
export type PageResult<T> = PaginationResponse<T>

/**
 * AI工具接口
 */
export interface AITool {
  id: string
  name: string
  description: string
  icon: string
  category: string
  price: number
  isFree: boolean
  tokenCost: number
  popularity: number
  status: 'active' | 'inactive'
}

/**
 * 订单接口
 */
export interface Order {
  id: string
  orderNo: string
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'processing' | 'completed' | 'timeout' | 'refunded'
  paymentMethod: 'wechat' | 'alipay' | 'credit-card'
  createTime: string
  payTime?: string
  items: OrderItem[]
  type?: 'subscription' | 'service' | 'product' | 'vip' | 'recharge' | 'refund' | 'consumption' | 'tool' | 'agent' | 'withdraw' | 'tokens'
}

/**
 * 订单项接口
 */
export interface OrderItem {
  id: string
  orderId: string
  productId: string
  productName: string
  quantity: number
  price: number
}

/**
 * VIP套餐接口
 */
export interface VIPPackage {
  id: string
  name: string
  description: string
  price: number
  duration: number
  tokenQuota: number
  features: string[]
  level: 'bronze' | 'silver' | 'gold' | 'platinum'
}

/**
 * 佣金统计接口
 */
export interface CommissionStats {
  totalCommission: number
  todayCommission: number
  monthCommission: number
  pendingCommission: number
  availableCommission: number
  totalInvites: number
  activeInvites: number
  dailyStats: CommissionDailyStats[]
}

/**
 * 佣金每日统计接口
 */
export interface CommissionDailyStats {
  date: string
  commission: number
  invites: number
}

/**
 * 用户设置接口
 */
export interface UserSettings {
  id: string
  userId: string
  language: string
  theme: 'light' | 'dark' | 'auto'
  notificationsEnabled: boolean
  emailNotificationsEnabled: boolean
  soundEnabled: boolean
  autoPlayEnabled: boolean
  defaultTool: string
  fontSize: number
  updatedAt: string
  notifications?: {
    enabled: boolean
    emailEnabled: boolean
    pushEnabled: boolean
    soundEnabled: boolean
  }
  privacy?: {
    publicProfile: boolean
    showEmail: boolean
    showPhone: boolean
    activityTracking: boolean
  }
  preferences?: {
    defaultTool: string
    fontSize: number
    autoSave: boolean
    keyboardShortcuts: boolean
  }
}

/**
 * 需求接口（通用，非后端 DTO 时使用）
 */
export interface Demand {
  id: string
  title: string
  description: string
  userId: string
  category: string
  budget: number
  status: 'draft' | 'published' | 'in-progress' | 'completed' | 'cancelled'
  createTime: string
  updateTime: string
  tags: string[]
}

// ==================== 后端 API 类型（与 8080/8000 后端 Swagger 一致，禁止前端自创字段） ====================

/**
 * 需求广场 - 列表项（与 Java 后端 /plaza/demands 返回的 PlazaDemand 一致）
 * @see swagger-api-docs.json components.schemas.PlazaDemand
 */
export interface PlazaDemand {
  id: number
  userId: string
  userName: string
  avatar: string
  title: string
  description: string
  type: string
  category: string
  /** 1-已完成 2-进行中 */
  status: number
  viewCount: number
  commentCount: number
  createTime: string
  updateTime: string
}

/**
 * 需求广场 - 发布请求体（与 Java 后端 CreatePlazaDemandRequest 一致）
 * @see swagger-api-docs.json components.schemas.CreatePlazaDemandRequest
 */
export interface CreatePlazaDemandRequest {
  title: string
  description?: string
  type?: string
  category?: string
}

/**
 * 后端分页结果（与 Java 后端 PageResult 一致）
 * @see swagger-api-docs.json components.schemas.PageResult
 */
export interface BackendPageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 需求广场 - 列表查询参数（与 GET /plaza/demands/list 的 query 一致）
 */
export interface PlazaDemandsListParams {
  page?: number
  pageSize?: number
  category?: string
  /** 1-已完成 2-进行中 */
  status?: number
  /** 搜索关键词 */
  keyword?: string
}

/**
 * 开发者信息接口
 */
export interface DeveloperInfo {
  id: string
  userId: string
  realName: string
  idCard: string
  bankAccount: string
  bankName: string
  alipayAccount: string
  status: 'pending' | 'approved' | 'rejected'
  createTime: string
  updateTime: string
}

/**
 * 开发者应用接口
 */
export interface DeveloperApp {
  id: string
  developerId: string
  name: string
  description: string
  appKey: string
  appSecret: string
  status: 'active' | 'inactive' | 'pending'
  createTime: string
  updateTime: string
  apiCalls: number
  todayApiCalls: number
}

/**
 * 开发者收益接口
 */
export interface DeveloperEarning {
  id: string
  developerId: string
  appId: string
  amount: number
  type: 'api-call' | 'subscription' | 'advertising'
  status: 'pending' | 'settled' | 'cancelled'
  createTime: string
  settleTime?: string
}

/**
 * AI模型信息接口
 */
export interface Model {
  modelCode: string
  code?: string
  name: string
  modelName?: string
  modelDesc?: string
  provider?: string
  id?: string
  displayName?: string
  modelId?: string
  supportsStreaming?: boolean
  supportsImages?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
  tags?: string[]
  icon?: string
  processingTime?: string
  is_new?: number
  is_top?: number
  /** 模型分类 */
  category?: string
  /** 模型类型 */
  type?: string
}

// ==================== 通用响应包装类型（管理端 API 复用） ====================

/** 通用列表响应 - 兼容多种后端分页格式 */
export interface ListResponse<T = Record<string, unknown>> {
  code?: number
  msg?: string
  message?: string
  rows?: T[]
  list?: T[]
  items?: T[]
  data?: T[]
  total?: number
  [key: string]: unknown
}

/** 通用详情响应 */
export interface DetailResponse<T = Record<string, unknown>> {
  code?: number
  msg?: string
  message?: string
  data: T
  [key: string]: unknown
}

/** 通用基础响应（新增/修改/删除 等写操作） */
export interface BaseResponse<T = unknown> {
  code?: number
  msg?: string
  message?: string
  data?: T
  [key: string]: unknown
}
