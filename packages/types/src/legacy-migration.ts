/**
 * 旧架构迁移补齐类型定义 (2026-07-22)
 *
 * 来源: git commit 3ee96cf09 (旧架构 client/src/api/*) 中存在但新架构未独立导出的类型。
 * 路由功能已迁移并连通 (apps/api/src/routes/*),但类型定义未迁移到共享类型层。
 * 本文件将这些类型集中到 packages/types,供跨端共享引用。
 *
 * P0 (28 组): 纯类型定义文件 — 路由已存在,类型未独立导出
 * P3 (7 组): FastAPI/监控/OAuth 类型 — 确认无新架构替代类型
 */

// ═══════════════════════════════════════════════════════════
// 1. Admin Dashboard 模块
// ═══════════════════════════════════════════════════════════

export interface DashboardOverview {
  totalUsers: number
  usersTrend: number
  todayOrders: number
  ordersTrend: number
  todayRevenue: number
  revenueTrend: number
  todayConversations: number
  conversationsTrend: number
}

export interface MonitorItem {
  key: string
  name: string
  percent: number
  detail: string
}

export interface MonitorOverview {
  items: MonitorItem[]
  updateTime: string
}

export interface ActivityTimelineItem {
  id: string
  type: string
  title: string
  description?: string
  operator: string
  createTime: string
}

// ═══════════════════════════════════════════════════════════
// 2. Agent Usedetail 模块
// ═══════════════════════════════════════════════════════════

export interface AgentUsageDetail {
  id: number
  agentId: string
  userId: string
  type: string
  createTime?: string | null
}

export interface DailyStat {
  date: string
  count: number
  uniqueUsers: number
}

export interface SummaryStat {
  totalCount: number
  totalUsers: number
  avgDailyCount: number
}

// ═══════════════════════════════════════════════════════════
// 3. Behavior 模块
// ═══════════════════════════════════════════════════════════

export type BehaviorTargetType =
  | 'article'
  | 'lesson'
  | 'answer'
  | 'question'
  | 'comment'
  | 'live'
  | 'channel'
  | 'circle'
  | string

export interface LikeRecord {
  id: number
  user_id: string
  user_name?: string
  target_type: string
  target_id: number
  created_at?: string
}

export type FavoriteRecord = LikeRecord

export interface CommentRecord {
  id: number
  user_id: string
  user_name?: string
  target_type: string
  target_id: number
  content: string
  parent_id?: number | null
  created_at?: string
}

export interface ReportRecord {
  id: number
  reporter_id: string
  target_type: string
  target_id: number
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  created_at?: string
}

export interface SensitiveWordRecord {
  id: number
  word: string
  category: string
  level: number
  status: number
  created_at?: string
}

// ═══════════════════════════════════════════════════════════
// 4. Category Link 模块
// ═══════════════════════════════════════════════════════════

export interface CategoryLink {
  id?: string
  categoryId?: string
  categoryName?: string
  linkedAgentId?: string
  linkedAgentName?: string
  linkType?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface CategoryLinkListParams {
  page?: number
  pageSize?: number
  categoryId?: string
  linkedAgentId?: string
  linkType?: string
  status?: number
  startTime?: string
  endTime?: string
}

// ═══════════════════════════════════════════════════════════
// 5. Docs 模块
// ═══════════════════════════════════════════════════════════

export interface DocUploadResponse {
  id: string
  title: string
  category: string
  path: string
  createdAt: string
  createdBy: string
  fileUrl?: string
  fileType?: string
}

export interface DocListItem {
  id: string
  title: string
  category: string
  path: string
  createdAt: string
  createdBy: string
  markdown?: string
  fileUrl?: string
  fileType?: string
}

export interface DocData {
  id: string
  title: string
  category: string
  markdown: string
  createdAt: string
  createdBy: string
  originalFileName?: string
  fileUrl?: string
  fileType?: string
}

// ═══════════════════════════════════════════════════════════
// 6. API Group 模块
// ═══════════════════════════════════════════════════════════

export interface ApiGroup {
  id: string
  name: string
  description?: string
  appIds?: string[]
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface CreateGroupRequest {
  name: string
  description?: string
  appIds?: string[]
}

export interface GroupListResponse {
  list: ApiGroup[]
  total: number
}

// ═══════════════════════════════════════════════════════════
// 7. Home 模块
// ═══════════════════════════════════════════════════════════

export interface HomeBanner {
  id: string
  title: string
  imageUrl: string
  linkUrl?: string
  sort: number
  status: number
}

export interface HomeRecommendation {
  id: string
  title: string
  description?: string
  imageUrl?: string
  linkUrl?: string
  type: string
  sort: number
}

// ═══════════════════════════════════════════════════════════
// 8. Models 模块
// ═══════════════════════════════════════════════════════════

export type ModelType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'coze'
  | 'dashscope'
  | 'baidu'
  | 'alibaba'
  | 'tencent'
  | 'doubao'
  | 'zhipu'
  | 'moonshot'
  | 'custom'

export interface PricingConfig {
  inputTokenPrice: number
  outputTokenPrice: number
  imagePrice?: number
  audioPrice?: number
  videoPrice?: number
  regionPricing?: Record<
    string,
    {
      inputTokenPrice: number
      outputTokenPrice: number
      imagePrice?: number
      audioPrice?: number
      videoPrice?: number
    }
  >
  bulkDiscounts?: {
    thresholds: number[]
    discounts: number[]
  }
}

export interface ProxyConfig {
  proxyUrl?: string
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted'
  failoverEnabled?: boolean
  cacheEnabled?: boolean
  cacheTTL?: number
  rateLimit?: {
    qps: number
    burst: number
  }
  apiKeys?: string[]
}

// ═══════════════════════════════════════════════════════════
// 9. Monitoring 模块 (P3)
// ═══════════════════════════════════════════════════════════

export interface PoolStats {
  totalConnections: number
  idleConnections: number
  activeConnections: number
  waitingCount: number
  queryCount: number
  errorCount: number
  avgQueryTime: number
  recommendations: string[]
}

export interface IndexUsage {
  tableName: string
  indexName: string
  indexScans: number
  tuplesRead: number
  tuplesFetched: number
  recommendation: string
}

export interface QueryPlanAnalysis {
  query: string
  plan: string
  executionTime?: number
  cost?: number
  rows?: number
  recommendations: string[]
}

// ═══════════════════════════════════════════════════════════
// 10. OAuth 模块 (P3)
// ═══════════════════════════════════════════════════════════

export interface QRCodeResponse {
  qrCodeUrl: string
  state: string
  expiresIn: number
}

export interface OAuthStatusResponse {
  status: 'pending' | 'success' | 'expired' | 'failed'
  token?: string
  refreshToken?: string
  user?: {
    uuid: string
    username: string
    nickname: string
    avatar?: string
    isVip: boolean
  }
}

export interface OAuthCallbackRequest {
  code: string
  state: string
}

export interface PaymentOrderRequest {
  outTradeNo: string
  subject: string
  description?: string
  totalAmount: number
  amount?: number
  body?: string
  openId?: string
}

export interface PaymentOrderResponse {
  payForm?: string
  prepayId?: string
  package?: string
  timeStamp?: string
  nonceStr?: string
  signType?: string
  paySign?: string
  outTradeNo: string
}

// ═══════════════════════════════════════════════════════════
// 11. Packages 模块
// ═══════════════════════════════════════════════════════════

export interface PackageInfo {
  id: string
  name: string
  description?: string
  price: number
  quota: number
  usedQuota: number
  remainingQuota: number
  status: 'active' | 'expired' | 'suspended'
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  appIds?: string[]
  apps?: Array<{ id: string; name: string }>
}

export interface PackageUsage {
  date: string
  used: number
  remaining: number
}

export interface PackageListResponse {
  list: PackageInfo[]
  total: number
}

// ═══════════════════════════════════════════════════════════
// 12. SDK 模块
// ═══════════════════════════════════════════════════════════

export type SdkLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'csharp'
  | 'swift'

export interface SdkConfig {
  language: SdkLanguage
  version: string
  baseUrl: string
  apiKey?: string
  timeout?: number
  retryConfig?: {
    maxRetries: number
    retryDelay: number
  }
}

export interface SdkGenerateResult {
  sdkContent: string
  language: SdkLanguage
  fileName: string
  dependencies?: string[]
  readme?: string
}

// ═══════════════════════════════════════════════════════════
// 13. Service Chat 模块
// ═══════════════════════════════════════════════════════════

export interface ChatRecord {
  id: string
  userId: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens?: number
  model?: string
  createdAt: string
}

export interface CreateChatRecordRequest {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokens?: number
}

export interface QueryChatRecordsRequest {
  sessionId?: string
  userId?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}

export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  model?: string
  tokens?: number
}

// ═══════════════════════════════════════════════════════════
// 14. Service Coze 模块
// ═══════════════════════════════════════════════════════════

export interface CozeStreamChatRequest {
  botId: string
  message: string
  conversationId?: string
  userId?: string
  stream?: boolean
  customVariables?: Record<string, unknown>
}

export type StreamChunkCallback = (chunk: string, done: boolean) => void

// ═══════════════════════════════════════════════════════════
// 15. Service Unified 模块
// ═══════════════════════════════════════════════════════════

export interface UnifiedGenerationRequest {
  type: 'text' | 'image' | 'audio' | 'video' | 'code'
  prompt: string
  model?: string
  params?: Record<string, unknown>
  stream?: boolean
}

export interface UnifiedGenerationResponse {
  id: string
  type: string
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdAt: string
}

export interface GenerationWebSocketCallbacks {
  onChunk?: (chunk: string) => void
  onComplete?: (result: UnifiedGenerationResponse) => void
  onError?: (error: Error) => void
}

// ═══════════════════════════════════════════════════════════
// 16. Service Variable 模块
// ═══════════════════════════════════════════════════════════

export interface VariableRetrieveRequest {
  botId: string
  variableName: string
  conversationId?: string
}

export interface VariableListRequest {
  botId: string
  conversationId?: string
  page?: number
  pageSize?: number
}

export interface VariableUpdateRequest {
  botId: string
  variableName: string
  variableValue: unknown
  conversationId?: string
}

export interface VariableCreateRequest {
  botId: string
  variableName: string
  variableValue: unknown
  description?: string
}

// ═══════════════════════════════════════════════════════════
// 17. Skills 模块
// ═══════════════════════════════════════════════════════════

export interface SkillsListResponse {
  skills: Array<{
    id: string
    name: string
    description?: string
    metadata?: Record<string, unknown>
  }>
  total: number
}

export interface SkillsEnhancedChatRequest {
  message: string
  skillIds: string[]
  conversationId?: string
  model?: string
  stream?: boolean
}

export interface SkillsEnhancedChatResponse {
  id: string
  content: string
  usedSkills: string[]
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdAt: string
}

// ═══════════════════════════════════════════════════════════
// 18. SSO 模块
// ═══════════════════════════════════════════════════════════

export interface SSOLoginResponse {
  token?: string
  accessToken?: string
  access_token?: string
  refreshToken?: string
  refresh_token?: string
  userId?: string
  username?: string
  nickname?: string
  avatar?: string
  expiresIn?: number
  [key: string]: unknown
}

export interface SSOLoginParams {
  uuid: string
  platform: 1 | 2
}

export enum EduPlatformType {
  ADMIN = 1,
  USER = 2,
}

// ═══════════════════════════════════════════════════════════
// 19. Tools 模块
// ═══════════════════════════════════════════════════════════

export interface Tool {
  id: string
  name: string
  description: string
  icon?: string
  category: string
  type: 'api' | 'plugin' | 'widget' | 'service'
  rating: number
  ratingCount: number
  usageCount: number
  price?: number
  isFree: boolean
  isFavorite?: boolean
  tags?: string[]
  createTime: string
  updateTime?: string
  documentation?: string
  creatorName?: string
}

export interface ToolCategory {
  id: string
  name: string
  description?: string
  icon?: string
  count?: number
}

// ═══════════════════════════════════════════════════════════
// 20. Workflows 模块
// ═══════════════════════════════════════════════════════════

export interface WorkflowNode {
  id: string
  type: 'agent' | 'condition' | 'loop' | 'parallel' | 'action' | 'input' | 'output'
  name: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
  label?: string
}

export interface WorkflowVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  defaultValue?: unknown
  description?: string
}

export interface WorkflowTrigger {
  type: 'api' | 'webhook' | 'schedule' | 'event'
  config: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: WorkflowVariable[]
  triggers?: WorkflowTrigger[]
  status: 'draft' | 'published' | 'archived'
  version: string
  createTime?: string
  updateTime?: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
}

// ═══════════════════════════════════════════════════════════
// 21. Unified Auth 模块
// ═══════════════════════════════════════════════════════════

export type LoginSource = 'main' | 'admin' | 'edu-web' | 'edu-admin' | 'user'

export interface UnifiedLoginRequest {
  phone: string
  password: string
  email?: string
  code?: string
  uuid?: string
  remember?: boolean
}

export interface UnifiedRegisterRequest {
  username: string
  password: string
  email?: string
  phone?: string
  code?: string
  uuid?: string
}

export interface UnifiedLoginResponse {
  token: string
  refreshToken?: string
  user: {
    id: string
    username: string
    nickname?: string
    avatar?: string
    email?: string
    phone?: string
    roleId?: number
  }
  expiresIn?: number
}

// ═══════════════════════════════════════════════════════════
// 22. User Export 模块
// ═══════════════════════════════════════════════════════════

export interface UserExportData {
  userInfo: {
    id: string
    uuid: string
    username: string
    email: string
    phone: string
    nickname: string
    avatar: string
    gender: number
    birthday: string
    signature: string
    createTime: string
    updateTime: string
  }
  orders?: Array<Record<string, unknown>>
  conversations?: Array<Record<string, unknown>>
  files?: Array<Record<string, unknown>>
  exportTime: string
}

// ═══════════════════════════════════════════════════════════
// 23. User Sys Link 模块
// ═══════════════════════════════════════════════════════════

export interface UserSysLink {
  id?: string
  userId?: string
  sysUserId?: string
  platformType?: string
  linkStatus?: number
  linkTime?: string
  lastSyncTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserSysLinkListParams {
  page?: number
  pageSize?: number
  userId?: string
  sysUserId?: string
  platformType?: string
  linkStatus?: number
  startTime?: string
  endTime?: string
}

// ═══════════════════════════════════════════════════════════
// 24. User SK 模块
// ═══════════════════════════════════════════════════════════

export interface UserSkItem {
  id: string
  userId: string
  skType: string
  skKey: string
  skValue: string
  remark?: string
  status: number
  createTime: string
  updateTime?: string
}

export interface UserSkListRes {
  list: UserSkItem[]
  total: number
}

export interface UserSkCreatePayload {
  skType: string
  skKey: string
  skValue: string
  remark?: string
}

// ═══════════════════════════════════════════════════════════
// 25. Remote Config 模块 (P2 - 已废弃)
// ═══════════════════════════════════════════════════════════

export interface FeatureFlag {
  key: string
  enabled: boolean
  description?: string
  rolloutPercentage?: number
  targetUsers?: string[]
}

export interface RemoteExperimentConfig {
  experimentId: string
  variants: Array<{
    name: string
    weight: number
    config: Record<string, unknown>
  }>
  targetSegment?: string
  active: boolean
}

// ═══════════════════════════════════════════════════════════
// 26. Service Appointment 模块 (P2 - 已废弃)
// ═══════════════════════════════════════════════════════════

export interface ServiceAppointment {
  id: string
  userId: string
  serviceId: string
  appointmentTime: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  remark?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentRequest {
  serviceId: string
  appointmentTime: string
  remark?: string
}

// ═══════════════════════════════════════════════════════════
// 27. V2 Business 模块 (P2 - 已废弃)
// ═══════════════════════════════════════════════════════════

export interface V2BusinessData {
  agents?: Array<Record<string, unknown>>
  courses?: Array<Record<string, unknown>>
  orders?: Array<Record<string, unknown>>
}

// ═══════════════════════════════════════════════════════════
// 28. FastAPI 类型 (P3)
// ═══════════════════════════════════════════════════════════

export interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: Array<Record<string, unknown>>
}

export interface CreateTaskRequest {
  type: string
  payload: Record<string, unknown>
  priority?: number
  callbackUrl?: string
}

export interface TaskResponse {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: Record<string, unknown>
  error?: string
  createdAt: string
  updatedAt: string
}

export interface ExecuteAgentRequest {
  agentId: string
  input: string
  sessionId?: string
  stream?: boolean
  tools?: string[]
}

export interface KnowledgeSearchRequest {
  query: string
  knowledgeBaseId?: string
  topK?: number
  threshold?: number
  filters?: Record<string, unknown>
}
