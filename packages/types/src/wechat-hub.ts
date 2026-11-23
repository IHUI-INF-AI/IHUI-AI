// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）跨端契约。
 *
 * 定位：把「微信账号接入 → 实时收消息 → 入库/去重 → AI 分析 → 主动发送」
 * 收成一条可审计的管道，覆盖官方 iLink、本地桥（WeChatFerry / RPA / chatlog）
 * 与 mock 三种后端。类型只描述 wire 形状，不承载任何实现。
 *
 * 与 im-gateway 的关系：im-gateway 解决的是 16 平台 webhook 的通用收发；
 * 本模块解决的是微信账号级的长连接、扫码登录、会话归并、群分析和主动动作。
 */

/** 通道后端。ilink=腾讯官方 ClawBot；bridge=本地 HTTP 桥；mock=演示/测试 */
export type WechatBackend = 'ilink' | 'bridge' | 'mock'

/** 账号连接状态 */
export type WechatAccountStatus =
  'disconnected' | 'connecting' | 'awaiting_scan' | 'online' | 'expired' | 'error'

/** 会话类型 */
export type WechatConversationKind = 'private' | 'group' | 'official' | 'service'

/** 消息类型（与 iLink item type / bridge kind 对齐） */
export type WechatMessageKind =
  'text' | 'image' | 'voice' | 'video' | 'file' | 'link' | 'card' | 'system' | 'other'

/** 消息方向 */
export type WechatMessageDirection = 'inbound' | 'outbound'

/** AI 分析类型 */
export type WechatAnalysisKind =
  'summary' | 'daily' | 'todos' | 'keywords' | 'relations' | 'sentiment' | 'profile'

/** 分析任务状态 */
export type WechatAnalysisStatus = 'pending' | 'running' | 'success' | 'failed'

/** 发送结果状态，对齐 im-outbound-policy 的分型语义 */
export type WechatSendStatus =
  | 'delivered'
  | 'business-rejected'
  | 'no-receipt'
  | 'http-error'
  | 'transport-error'
  | 'circuit-open'
  | 'local-rejected'

/** 账号（脱敏视图：不返回 userId 与凭据密文） */
export interface WechatAccountView {
  id: string
  label: string
  backend: WechatBackend
  status: WechatAccountStatus
  externalId: string | null
  avatarUrl: string | null
  lastError: string | null
  lastPollAt: string | null
  /** 是否启用接收方白名单（发送策略） */
  allowlistEnabled: boolean
  createdAt: string
  updatedAt: string
  /** 非敏感运行信息：联系人缓存数量、是否为白名单模式等 */
  metadata: Record<string, unknown>
}

/** 新建账号入参 */
export interface WechatAccountCreateInput {
  label: string
  backend: WechatBackend
  /** 桥后端：baseUrl / token / sendPath / messagesPath；iLink 可空 */
  credentials?: Record<string, string>
  metadata?: Record<string, unknown>
}

/** 账号状态轮询返回 */
export interface WechatAccountStatusView {
  accountId: string
  status: WechatAccountStatus
  online: boolean
  lastError: string | null
  lastPollAt: string | null
  pendingQrCode: string | null
}

/** 扫码二维码 */
export interface WechatQrCodeView {
  accountId: string
  qrcode: string
  /** data:image/png;base64,... 或 https URL */
  imageUrl: string | null
  expiresAt: string | null
  status: WechatAccountStatus
}

/** 会话 */
export interface WechatConversationView {
  id: string
  accountId: string
  platformChatId: string
  kind: WechatConversationKind
  title: string
  memberCount: number
  unreadCount: number
  lastMessageAt: string | null
  metadata: Record<string, unknown>
}

/** 消息 */
export interface WechatMessageView {
  id: string
  accountId: string
  conversationId: string
  direction: WechatMessageDirection
  kind: WechatMessageKind
  content: string
  mediaUrl: string | null
  senderId: string | null
  senderName: string | null
  platformMessageId: string | null
  sentAt: string
  createdAt: string
  /** 仅返回裁剪后的原始字段，避免把整包 payload 暴露给端上 */
  rawPayload: Record<string, unknown>
}

/** 联系人（入站发送者自动归档，本地可维护备注/标签/拉黑） */
export interface WechatContactView {
  id: string
  accountId: string
  platformUserId: string
  displayName: string
  remark: string
  tags: string[]
  blocked: boolean
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

/** 联系人本地维护入参 */
export interface WechatContactUpdateInput {
  remark?: string
  tags?: string[]
  blocked?: boolean
}

/** 群成员 */
export interface WechatGroupMemberView {
  id: string
  accountId: string
  conversationId: string
  memberId: string
  nickname: string
  role: 'owner' | 'admin' | 'member' | string
  updatedAt: string
}

/** 自动回复匹配方式 */
export type WechatAutoReplyMatchType = 'contains' | 'exact' | 'prefix'

/** 自动回复作用域 */
export type WechatAutoReplyScope = 'all' | 'private' | 'group'

/** 自动回复规则 */
export interface WechatAutoReplyRuleView {
  id: string
  accountId: string
  name: string
  enabled: boolean
  matchType: WechatAutoReplyMatchType
  keywords: string[]
  replyText: string
  scope: WechatAutoReplyScope
  cooldownSeconds: number
  lastTriggeredAt: string | null
  createdAt: string
  updatedAt: string
}

/** 自动回复规则入参（创建/更新共用；更新时全部可选） */
export interface WechatAutoReplyRuleInput {
  name?: string
  enabled?: boolean
  matchType?: WechatAutoReplyMatchType
  keywords?: string[]
  replyText?: string
  scope?: WechatAutoReplyScope
  cooldownSeconds?: number
}

/** 日报计划 */
export interface WechatDigestScheduleView {
  id: string
  accountId: string
  enabled: boolean
  hour: number
  minute: number
  timezone: string
  target: string
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

/** 日报计划入参 */
export interface WechatDigestScheduleInput {
  enabled?: boolean
  hour?: number
  minute?: number
  timezone?: string
  target?: string
}

/** 发送入参 */
export interface WechatSendInput {
  accountId: string
  /** iLink 为对方 user_id；群聊为群 chat_id；bridge 由桥定义 */
  target: string
  kind?: Exclude<WechatMessageKind, 'system' | 'other'>
  text?: string
  mediaUrl?: string
  /** 引用回复 */
  replyToMessageId?: string
  /** 群聊 @ 成员（bridge 后端透传；iLink 不支持群聊） */
  mentions?: string[]
  /** 只走策略校验与审计，不真正投递 */
  dryRun?: boolean
}

/** 发送结果 */
export interface WechatSendResult {
  ok: boolean
  status: WechatSendStatus
  platformMessageId: string | null
  reason: string | null
  attempts: number
  /** 被策略拦截时给出具体规则名 */
  rejectedBy: string | null
}

/** 桥动作名：只对 bridge 后端实现，iLink 官方通道显式返回 unsupported。 */
export type WechatBridgeAction =
  | 'contact.sync'
  | 'contact.delete'
  | 'group.create'
  | 'group.invite'
  | 'group.kick'
  | 'group.rename'
  | 'group.announce'
  | 'moment.publish'

/** 桥动作结果；data 由桥原样返回，平台侧只做展示与审计。 */
export interface WechatActionResult {
  ok: boolean
  status: 'accepted' | 'unsupported' | 'failed'
  data: Record<string, unknown>
  reason: string | null
}

/** 群管理动作入参 */
export interface WechatGroupActionInput {
  action: 'create' | 'invite' | 'kick' | 'rename' | 'announce'
  conversationId?: string
  memberIds?: string[]
  title?: string
  text?: string
}

/** 朋友圈发布入参 */
export interface WechatMomentInput {
  text: string
  mediaUrls?: string[]
}

/** 群发入参：targets 与 tags 二选一；都不给时取全部未拉黑联系人。 */
export interface WechatBroadcastInput {
  accountId: string
  kind?: 'text' | 'image' | 'file' | 'link' | 'card'
  text?: string
  mediaUrl?: string
  targets?: string[]
  tags?: string[]
  /** 默认 false：跳过 blocked 联系人 */
  includeBlocked?: boolean
  /** 每批条数，默认 20；批间固定 200ms，避免触发平台频控 */
  batchSize?: number
  dryRun?: boolean
}

export interface WechatBroadcastTargetResult {
  target: string
  ok: boolean
  status: string
  platformMessageId: string | null
  reason: string | null
}

export interface WechatBroadcastResult {
  total: number
  sent: number
  failed: number
  results: WechatBroadcastTargetResult[]
}

/** 知识库文档与检索结果（复用 zhs_knowledge_*，按 collection 隔离）。 */
export interface WechatKnowledgeDocView {
  id: number
  title: string
  chunkCount: number
  createdAt: string | null
}

export interface WechatKnowledgeHit {
  docId: number
  content: string
  score: number
  chunkIndex: number
}

/** 分析入参 */
export interface WechatAnalyzeInput {
  accountId: string
  conversationId?: string
  kind: WechatAnalysisKind
  /** 取最近 N 条，默认 200，上限 1000 */
  limit?: number
  /** 指定模型；不传走默认 */
  model?: string
  /** 强制重新分析（默认命中 inputHash 缓存直接返回） */
  force?: boolean
}

/** 分析结果结构（LLM 与本地规则共用） */
export interface WechatAnalysisResult {
  title: string | null
  summary: string
  highlights: string[]
  todos: Array<{
    text: string
    owner: string | null
    due: string | null
    messageId: string | null
  }>
  keywords: Array<{ word: string; count: number }>
  participants: Array<{
    id: string
    name: string | null
    messageCount: number
  }>
  /** relations 分析专用：谁在回应谁（同一时间窗内的相邻发言） */
  relations?: Array<{
    from: string
    to: string
    count: number
  }>
  risks: string[]
  stats: {
    messageCount: number
    participantCount: number
    startAt: string | null
    endAt: string | null
  }
  /** 结论来源：llm=模型生成；local=本地规则（未配置模型时的降级） */
  generatedBy: 'llm' | 'local'
}

/** 分析任务视图 */
export interface WechatAnalysisRunView {
  id: string
  accountId: string
  conversationId: string | null
  kind: WechatAnalysisKind
  status: WechatAnalysisStatus
  result: WechatAnalysisResult | null
  model: string | null
  tokens: number | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

/** 动作审计 */
export interface WechatActionLogView {
  id: string
  accountId: string
  action: string
  target: string | null
  status: string
  error: string | null
  createdAt: string
}

/** 后端能力矩阵（前端据此渲染"这个后端能做什么"） */
export interface WechatBackendCapability {
  backend: WechatBackend
  label: string
  compliance: 'official' | 'local-bridge' | 'mock'
  supports: {
    qrcodeLogin: boolean
    text: boolean
    image: boolean
    file: boolean
    video: boolean
    voice: boolean
    group: boolean
    moments: boolean
    typing: boolean
    proactivePush: boolean
    webhookInbound: boolean
  }
  notes: string
}

/** MCP 工具描述（供 /api/wechat-hub/mcp/tools 与外部 MCP 网关消费） */
export interface WechatMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
