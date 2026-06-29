/**
 * API服务相关类型定义
 * 用于用户API令牌管理、使用统计、计费等功能
 */

/**
 * API令牌状态枚举
 */
export enum ApiTokenStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

/**
 * API协议类型枚举
 */
export enum ApiProtocolType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  CUSTOM = 'custom',
}

/**
 * 计费类型枚举
 */
export enum BillingType {
  TOKEN = 'token', // 按Token计费
  REQUEST = 'request', // 按请求次数计费
  SUBSCRIPTION = 'subscription', // 订阅制
}

/**
 * API令牌接口
 */
export interface ApiToken {
  id: string
  userId: string
  name: string // 令牌名称（便于识别）
  token: string // API密钥（sk-xxx格式）
  tokenPrefix: string // 令牌前缀（用于展示，如sk-xxx...xxx）
  status: ApiTokenStatus
  appId?: string // 关联的应用ID
  appName?: string // 关联的应用名称（用于显示）
  // 权限配置
  permissions: ApiTokenPermissions
  // 限制配置
  limits: ApiTokenLimits
  // 使用统计
  usage: ApiTokenUsage
  // 时间信息
  createdAt: string
  updatedAt: string
  expiresAt?: string // 过期时间（可选）
  lastUsedAt?: string // 最后使用时间
}

/**
 * API令牌权限配置
 */
export interface ApiTokenPermissions {
  allowedModels: string[] // 允许使用的模型ID列表（空数组表示全部）
  allowedCapabilities: ApiCapability[] // 允许的能力（chat/image/video/audio）
  ipWhitelist: string[] // IP白名单（空数组表示不限制）
  protocols: ApiProtocolType[] // 支持的API协议
}

/**
 * API能力类型
 */
export type ApiCapability = 'chat' | 'image' | 'video' | 'audio' | 'embedding' | 'completion'

/**
 * API令牌限制配置
 */
export interface ApiTokenLimits {
  maxQuota: number // 最大额度（-1表示无限）
  usedQuota: number // 已使用额度
  maxRequestsPerMinute: number // 每分钟最大请求数（0表示不限制）
  maxRequestsPerDay: number // 每天最大请求数（0表示不限制）
  maxTokensPerRequest: number // 单次请求最大Token数（0表示不限制）
}

/**
 * API令牌使用统计
 */
export interface ApiTokenUsage {
  totalRequests: number // 总请求次数
  totalInputTokens: number // 总输入Token数
  totalOutputTokens: number // 总输出Token数
  totalCost: number // 总费用
  todayRequests: number // 今日请求次数
  todayInputTokens: number // 今日输入Token数
  todayOutputTokens: number // 今日输出Token数
  todayCost: number // 今日费用
}

/**
 * 创建API令牌请求参数
 */
export interface CreateApiTokenParams {
  name: string
  appId?: string // 关联的应用ID
  expiresAt?: string
  permissions?: Partial<ApiTokenPermissions>
  limits?: Partial<ApiTokenLimits>
}

/**
 * 更新API令牌请求参数
 */
export interface UpdateApiTokenParams {
  name?: string
  appId?: string // 关联的应用ID
  status?: ApiTokenStatus
  expiresAt?: string
  permissions?: Partial<ApiTokenPermissions>
  limits?: Partial<ApiTokenLimits>
}

/**
 * API调用记录
 */
export interface ApiCallLog {
  id: string
  tokenId: string
  userId: string
  appId?: string // 关联的应用ID
  appName?: string // 应用名称（用于显示）
  modelId: string
  modelName: string
  endpoint: string // 调用端点
  method: string // HTTP方法
  protocol: ApiProtocolType // 使用的协议
  // 请求信息
  requestTime: string
  responseTime: string
  latency: number // 响应延迟（毫秒）
  // Token统计
  inputTokens: number
  outputTokens: number
  totalTokens: number
  // 费用
  cost: number
  // 状态
  status: 'success' | 'error' | 'timeout' | 'rate_limited'
  errorMessage?: string
  // 来源信息
  ipAddress: string
  userAgent?: string
  // 完整请求/响应信息（详情查看时加载）
  requestHeaders?: Record<string, string>
  requestBody?: string | Record<string, unknown>
  responseHeaders?: Record<string, string>
  responseBody?: string | Record<string, unknown>
  statusCode?: number
}

/**
 * API使用统计（聚合数据）
 */
export interface ApiUsageStats {
  // 时间范围
  startDate: string
  endDate: string
  // 总量统计
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  // 成功率
  successRate: number
  errorCount: number
  // 平均值
  avgLatency: number
  avgTokensPerRequest: number
  // 按模型统计
  modelStats: ModelUsageStat[]
  // 按日期统计
  dailyStats: DailyUsageStat[]
  // 按时段统计
  hourlyStats: HourlyUsageStat[]
}

/**
 * 模型使用统计
 */
export interface ModelUsageStat {
  modelId: string
  modelName: string
  requests: number
  inputTokens: number
  outputTokens: number
  cost: number
  percentage: number // 占比
}

/**
 * 每日使用统计
 */
export interface DailyUsageStat {
  date: string
  requests: number
  inputTokens: number
  outputTokens: number
  cost: number
}

/**
 * 每小时使用统计
 */
export interface HourlyUsageStat {
  hour: number // 0-23
  requests: number
  inputTokens: number
  outputTokens: number
}

/**
 * API定价信息
 */
export interface ApiPricing {
  modelId: string
  modelName: string
  provider: string
  // 价格（每1000 Token）
  inputPrice: number // 输入Token价格
  outputPrice: number // 输出Token价格
  // 单位
  currency: string // 货币单位（CNY/USD）
  unit: number // 计价单位（1000 Token）
  // 折扣
  discount?: number // 折扣率（0-1）
  discountEndTime?: string // 折扣结束时间
}

/**
 * API端点信息
 */
export interface ApiEndpoint {
  id: string
  name: string
  path: string // 端点路径
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  protocol: ApiProtocolType
  description: string
  // 支持的模型
  supportedModels: string[]
  // 请求示例
  requestExample?: string
  // 响应示例
  responseExample?: string
  // 参数说明
  parameters?: ApiParameter[]
}

/**
 * API参数说明
 */
export interface ApiParameter {
  name: string
  type: string
  required: boolean
  description: string
  default?: unknown
  example?: unknown
}

/**
 * 模型API信息（用于展示每个模型的API入口）
 */
export interface ModelApiInfo {
  modelId: string
  modelName: string
  displayName: string
  provider: string
  category: 'chat' | 'image' | 'video' | 'audio'
  // 支持的协议
  supportedProtocols: ApiProtocolType[]
  // 端点信息
  baseUrl: string
  endpoints: {
    openai?: string // OpenAI兼容端点
    anthropic?: string // Anthropic兼容端点
    native?: string // 原生端点
  }
  // 定价
  pricing: ApiPricing
  // 能力
  capabilities: ApiCapability[]
  // 文档链接
  documentationUrl?: string
  // 是否支持流式输出
  supportsStreaming: boolean
}

/**
 * API服务配置
 */
export interface ApiServiceConfig {
  // 基础配置
  baseUrl: string
  version: string
  // 默认限制
  defaultLimits: ApiTokenLimits
  // 支持的协议
  supportedProtocols: ApiProtocolType[]
  // 支持的能力
  supportedCapabilities: ApiCapability[]
  // 计费配置
  billingType: BillingType
  minRechargeAmount: number // 最小充值金额
  // 文档
  documentationUrl: string
  sdkUrls: {
    python?: string
    nodejs?: string
    java?: string
    go?: string
  }
}

/**
 * 用户API余额信息
 */
export interface UserApiBalance {
  userId: string
  balance: number // 当前余额
  currency: string // 货币单位
  frozenAmount: number // 冻结金额
  totalRecharge: number // 总充值金额
  totalConsumption: number // 总消费金额
  // 赠送额度
  giftBalance: number
  giftExpireTime?: string
}

/**
 * API充值记录
 */
export interface ApiRechargeRecord {
  id: string
  userId: string
  amount: number
  currency: string
  paymentMethod: 'wechat' | 'alipay' | 'bank' | 'gift'
  status: 'pending' | 'success' | 'failed' | 'refunded'
  orderNo: string
  transactionId?: string
  createdAt: string
  paidAt?: string
  remark?: string
}
