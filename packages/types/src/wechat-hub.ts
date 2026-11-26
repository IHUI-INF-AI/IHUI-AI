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

/**
 * 自动回复匹配方式。
 * agent = AI 智能回复：replyText 作为人设/系统提示词，keywords 为空表示接管全部消息。
 */
export type WechatAutoReplyMatchType = 'contains' | 'exact' | 'prefix' | 'agent'

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

/** AI 回复预览入参：只生成不发送 */
export interface WechatAutoReplyPreviewInput {
  text: string
  /** 不传则取该账号最近活跃会话作为上下文 */
  conversationId?: string
}

/** AI 回复预览结果 */
export interface WechatAutoReplyPreviewResult {
  replyText: string
}

/** 微信消息导出格式 */
export type WechatExportFormat =
  | 'jsonl'
  | 'csv'
  | 'html'
  | 'markdown'
  | 'xlsx'
  | 'chatlab'
  | 'sql'

/** 微信消息导出入参 */
export interface WechatExportInput {
  format?: WechatExportFormat
  /** 不传则导出该账号全部会话 */
  conversationId?: string
  since?: string
  until?: string
  limit?: number
  /** 展示时区，默认 Asia/Shanghai；只影响 html/markdown/xlsx 的时间列 */
  timezone?: string
}

/** 微信消息导出结果（content 由前端落成 Blob 下载） */
export interface WechatExportResult {
  filename: string
  mimeType: string
  content: string
  count: number
  /** 文本格式为 utf8；二进制格式（xlsx）为 base64，前端需 atob → Uint8Array */
  encoding?: 'utf8' | 'base64'
}

/** 单条历史消息导入行；字段与 IHUI 导出的 JSONL 对齐。 */
export interface WechatImportMessageRow {
  /** 平台会话 id：私聊 wxid、群聊 xxxx@chatroom */
  platformChatId: string
  platformMessageId?: string
  conversationTitle?: string
  conversationKind?: WechatConversationKind
  direction?: WechatMessageDirection
  kind?: WechatMessageKind
  senderId?: string
  senderName?: string
  content?: string
  mediaUrl?: string
  /** ISO 时间；也接受毫秒/秒时间戳 */
  sentAt?: string | number
}

/** 历史消息导入入参 */
export interface WechatImportMessagesInput {
  messages: WechatImportMessageRow[]
}

/** 历史消息导入结果 */
export interface WechatImportMessagesResult {
  imported: number
  skipped: number
  conversations: number
  errors: Array<{ index: number; reason: string }>
}

/** 从本地桥自动回填历史消息的入参 */
export interface WechatHistorySyncInput {
  /** 单次最多拉取多少条，默认 500 */
  limit?: number
  /** 只回填某个会话；不传则桥按自己的可见范围拉取 */
  conversationId?: string
}

/** 从本地桥自动回填历史消息的结果 */
export interface WechatHistorySyncResult extends WechatImportMessagesResult {
  fetched: number
  status: WechatActionResult['status']
  reason: string | null
  source: { db: string | null; table: string | null } | null
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
  | 'group.members'
  | 'history.fetch'
  | 'moment.publish'
  | 'moment.fetch'
  | 'chat.switch'
  | 'friend.scan'
  | 'friend.accept'

/** 桥动作结果；data 由桥原样返回，平台侧只做展示与审计。 */
export interface WechatActionResult {
  ok: boolean
  status: 'accepted' | 'unsupported' | 'failed'
  data: Record<string, unknown>
  reason: string | null
}

/** 好友申请的类型：加好友请求与进群邀请分开，前端标签与提示文案都按这个区分。 */
export type WechatFriendRequestKind = 'friend' | 'group-invite'

/**
 * 桥扫描出来的一条待处理申请。
 *
 * requestId 是桥侧用控件指纹算出来的标识，通过时必须拿它重新枚举并比对控件名，
 * 所以这里只存标识与展示字段，不存任何 UIA 句柄——跨进程句柄本来也传不过来。
 */
export interface WechatFriendRequestView {
  requestId: string
  nickname: string
  /**
   * 昵称来源：`control` 表示从行内控件真实读到；`unavailable` 表示这一行确实读不到人名
   * （例如只抓到按钮、或页面结构变了）。读不到时允许 nickname 为空串，但前端必须据此
   * 显示「昵称未读到」而不是留白或填占位符，避免让人以为对方真的没名字。
   */
  nicknameSource: 'control' | 'unavailable'
  source: string
  kind: WechatFriendRequestKind
  /** UIA 里有 InvokePattern 才算可点；不可点的只能人工去客户端处理。 */
  clickable: boolean
  /** 桥侧扫描到这条的时间戳。 */
  seenAt: number
}

/** 好友扫描结果；status 为 disabled 时 requests 一定为空，前端据此显示关闭文案。 */
export interface WechatFriendScanView {
  ok: boolean
  status: 'ok' | 'disabled' | 'failed'
  reason: string | null
  requests: WechatFriendRequestView[]
  scannedAt: number
  /** 进入「新的朋友」页面后真实读到的候选元素数（过滤前），用来核对有没有被静默丢弃。 */
  rawCount: number
  /** 本次扫描是否真的进入了「新的朋友」页面（未进入时说明只读到了通讯录入口）。 */
  entered: boolean
  /** 被判定为导航入口（通讯录里的「新的朋友」行）而排除的行数。 */
  entryExcluded: number
  /** 本次结果是上一次成功采集的快照（微信窗口被收起时读不到界面，不谎报失败）；此时数据可能不是最新。 */
  stale?: boolean
  /** 快照过期的原因；stale=true 时才有值。 */
  staleReason?: string | null
  /** 结果来自缓存时，距上次成功采集的毫秒数。 */
  cacheAgeMs?: number
}

/** 通过申请的回执；requestId 原样带回，便于审计对账。 */
export interface WechatFriendAcceptView {
  ok: boolean
  status: 'accepted' | 'disabled' | 'failed'
  requestId: string
  reason: string | null
  errorCode: string | null
}

/** 好友自动化策略：默认关，开启后才允许点客户端。 */
export interface WechatFriendsPolicy {
  enabled: boolean
  /** 每小时最多通过几个申请，超出返回 RATE_LIMITED。 */
  maxAcceptsPerHour: number
  /** 每天（滚动 24 小时）最多通过几个申请，超出同样 RATE_LIMITED；默认 10。 */
  maxAcceptsPerDay?: number
  /** 两次通过之间至少隔多少秒，防连点触发风控；默认 60，0 表示不限。 */
  minGapSeconds?: number
}

/** 一条好友自动化审计，保留最近 20 条写回账号 metadata。 */
export interface WechatFriendAuditEntry {
  at: number
  requestId: string
  nickname: string
  ok: boolean
  status: string
  errorCode: string | null
}

/** 「新朋友」卡片的后端聚合视图：策略 + 扫描结果 + 审计。 */
export interface WechatFriendsOverview {
  policy: WechatFriendsPolicy
  scan: WechatFriendScanView
  /** 最近审计，最多 20 条；前端只展示最近 5 条。 */
  audit: WechatFriendAuditEntry[]
}

/** 群管理动作入参 */
export interface WechatGroupActionInput {
  action: 'create' | 'invite' | 'kick' | 'rename' | 'announce'
  conversationId?: string
  memberIds?: string[]
  title?: string
  text?: string
  /** 写动作一次性确认令牌：由预览接口签发，绑定「动作 + 群 + 目标集合」，过期作废 */
  confirmToken?: string
  /** 只出影响面、不真执行；与预览接口等价，方便脚本先试 */
  dryRun?: boolean
}

/** 群写动作预览单里的单个目标 */
export interface WechatGroupActionPlanTarget {
  memberId: string
  name: string | null
  /** 为什么选中他（例如「30 天没说话」）；人工判断用 */
  reason: string | null
}

/**
 * 群写动作预览单。
 *
 * 群管理是「不可逆 + 可被风控」的一类动作，所以执行路径必须是：
 * 先拿这张单子看清楚会动谁 → 人工确认 → 用一次性 token 在 60 秒内执行。
 * 没有 token 的写请求一律拒绝，避免脚本/误点把整群踢空。
 */
export interface WechatGroupActionPlan {
  action: WechatGroupActionInput['action']
  conversationId: string
  chatTitle: string
  targets: WechatGroupActionPlanTarget[]
  /** 执行后真实会发生什么，用大白话写给非技术用户看 */
  effect: string
  warnings: string[]
  confirmToken: string
  expiresAt: string
}

/** 账号级群写策略（默认全关，开了也仍然受单次/频次上限约束） */
export interface WechatGroupWritePolicy {
  enabled: boolean
  /** 单次动作最多动几个人 */
  maxTargetsPerAction: number
  /** 每小时最多执行几次写动作 */
  maxActionsPerHour: number
}

/** 一次群写动作的审计记录；发生在账号 metadata 里，服务重启也留得住。 */
export interface WechatGroupWriteAuditEntry {
  /** ISO 时间 */
  at: string
  action: string
  conversationId: string | null
  chatTitle: string
  memberIds: string[]
  /** 桥是否真的执行成功；false 表示被闸拦下或桥报错 */
  ok: boolean
  /** 失败时的错误码，成功为 null */
  status: string | null
}

/** 群写审计视图：最近 20 次动作 + 当前窗口剩余额度 */
export interface WechatGroupWriteAuditView {
  entries: WechatGroupWriteAuditEntry[]
  /** 最近一小时已成功执行的次数 */
  windowCount: number
  windowLimit: number
  /** 还能执行几次；到 0 就必须等窗口滑过 */
  remaining: number
}

/** 桥体检结果；reachable=false 时 error 会给一句人话，httpStatus 为 null。 */
export interface WechatBridgeStatusView {
  baseUrl: string
  reachable: boolean
  httpStatus: number | null
  latencyMs: number
  driver: string | null
  online: boolean | null
  status: string | null
  mode: string | null
  account: string | null
  queued: number | null
  momentSeq: number | null
  error: string | null
}

/** 从桥同步群成员快照的结果 */
export interface WechatGroupMembersSyncResult {
  synced: number
  inserted: number
  updated: number
  removed: number
  members: WechatGroupMemberView[]
  result: WechatActionResult
}

/**
 * 朋友圈遍历终止原因。
 *
 * 必须区分清楚，不能把「抓到 30 页上限」当成失败：
 *  - page-limit      达到 maxPages 上限，后面很可能还有数据
 *  - scroll-stalled  滚轮没能改变页面（未定位到遮挡窗口）
 *  - occluded        微信窗口被其它窗口遮挡，后台滚轮无效
 *  - no-more-data    已经翻到朋友圈底部，确实没有更多
 *  - no-content      页面抓到了，但 OCR 没识别到正文（图片动态等）
 *  - error           驱动/截图/脚本失败
 *  - unsupported     当前后端不支持朋友圈遍历
 */
export type WechatMomentStopReason =
  | 'page-limit'
  | 'scroll-stalled'
  | 'occluded'
  | 'no-more-data'
  | 'no-content'
  | 'error'
  | 'unsupported'

/** 朋友圈发布入参 */
export interface WechatMomentInput {
  text: string
  mediaUrls?: string[]
}

/** 朋友圈只读遍历入参；OCR 驱动按页滚动，wcfhttp 走 /pyq 翻页。 */
export interface WechatMomentFetchInput {
  /** 最多抓多少页，1–30；默认 3 */
  maxPages?: number
  /** wcfhttp 的起始朋友圈 id；0 表示最新页 */
  id?: number
}

/** 一条朋友圈动态；OCR 来源可能没有 createdAt/mediaUrls。 */
export interface WechatMomentCommentView {
  /** 评论者 wxid；DB sidecar 可拿到，OCR/UIA 通常为空 */
  username?: string
  nickname?: string
  content: string
  createTime?: number | null
  commentId?: string | null
  refCommentId?: string | null
}

export interface WechatMomentMediaFileView {
  /** 真实落盘文件名，不是 qpic URL 或占位图 */
  name: string
  size: number
  contentType: string
}

export interface WechatMomentView {
  id: string
  authorId: string | null
  authorName: string
  content: string
  mediaUrls: string[]
  createdAt: number | null
  source: string
  page?: number
  /**
   * 作者是否真的映射到了已知联系人/群成员。
   * OCR 拿不到 wxid 时这里是 false，authorName 只是 OCR 文本，不是平台身份。
   */
  authorResolved?: boolean
  /**
   * 界面上读到的相对时间原文（如「5分钟前」「昨天」）。
   * 只保留原文，不折算成时间戳：换算规则不可靠，宁可让上层自己判断。
   */
  timeText?: string
  /** 界面上读到的图片数量；只有数量，没有图片二进制或链接 */
  imageCount?: number
  /** 评论区里读到的原文行；未映射评论作者，也不代表点赞 */
  commentTexts?: string[]
  /** DB sidecar：真实点赞名单（昵称或 wxid） */
  likeUsers?: string[]
  /** DB sidecar：点赞者 wxid 名单（可为空） */
  likeUserIds?: string[]
  /** DB sidecar：点赞字段是否真实可得 */
  likes?: boolean
  /** DB sidecar：评论字段是否真实可得 */
  comments?: boolean
  /** DB sidecar：带作者/时间的评论结构 */
  commentsData?: WechatMomentCommentView[]
  /** DB sidecar：视频数量 */
  videoCount?: number
  /** DB sidecar：图片 + 视频的真实媒体条目数（不等于 mediaUrls 的去重 URL 数） */
  mediaCount?: number
  /** DB sidecar：本次真实落盘的媒体条目数 */
  mediaAvailableCount?: number
  /** DB sidecar：平台声明但本次没有真实落盘的媒体条目数 */
  mediaMissingCount?: number
  /** DB sidecar：ISO 时间，仅作为 createdAt 的可读副本 */
  createdAtIso?: string
  /** DB sidecar 可选图片落盘目录；未开启下载时不返回 */
  mediaLocalDir?: string
  /** DB sidecar 是否至少成功落盘一个媒体 */
  mediaDownloaded?: boolean
  /** DB sidecar 媒体来源：本地 Sns 缓存或原始 URL */
  mediaDownloadSource?: 'cache' | 'url' | 'existing'
  /** DB sidecar 图片落盘失败原因；缓存和原始 URL 都不可得时出现 */
  mediaDownloadError?: string
}

export interface WechatMomentArchiveStat {
  /** 本次新归档条数 */
  added: number
  /** 本次命中去重、只更新计数/时间的条数 */
  updated: number
  /** 归档层当前总条数 */
  total: number
}

/**
 * 朋友圈结构化字段可得性：驱动这次真实拿到了哪些字段。
 *
 * 这是「事实声明」不是「能力承诺」：为 false 时调用方/UI 必须承认缺失，
 * 绝不允许用占位值把点赞、评论、图片补造成看起来完整的数据。
 */
export interface WechatMomentFieldAvailability {
  /** 图片 URL / 图片元数据 */
  media: boolean
  /** 点赞名单或点赞数 */
  likes: boolean
  /** 评论正文 */
  comments: boolean
  /** 作者是否能映射到真实联系人/群成员身份 */
  authorIdentity: boolean
  /** 缺失原因，供 UI 直接展示；四项全可得时为 null */
  reason: string | null
}

export interface WechatMomentFetchResult {
  moments: WechatMomentView[]
  fetched: number
  pages: number
  source: string | null
  /**
   * 兼容字段：只要有「页数上限 / 滚轮停滞 / 页面不足」就为 true。
   * 判断展示语义请优先看 stopReason 与 limitReached，不要用 partial 一刀切。
   */
  partial: boolean
  /** 遍历终止原因；未知时为 null */
  stopReason: WechatMomentStopReason | null
  /** 是否是因为达到 maxPages 上限而停下；true 时后续很可能还有数据 */
  limitReached: boolean
  /** 遮挡导致后台滚轮无效时，桥报告的遮挡窗口标题 */
  occludedBy: string | null
  reason: string | null
  result: WechatActionResult
  /** 桥每次成功抓取后写本地归档的统计；后端未实现时缺省 */
  archive?: WechatMomentArchiveStat
  /** DB sidecar：本次是否启用了媒体落盘 */
  downloadMedia?: boolean
  /** DB sidecar：本次是否只导出本地缓存、未访问原始媒体 URL */
  localCacheOnly?: boolean
  /** DB sidecar：媒体总数（图片 + 视频） */
  mediaTotal?: number
  /** DB sidecar：实际写入磁盘的媒体文件数 */
  downloadedMedia?: number
  /** DB sidecar：命中微信本地 Sns 缓存的媒体数 */
  mediaCacheHits?: number
  /** DB sidecar：上一次运行已落盘、本次按清单复用且来源未知的媒体数 */
  mediaExisting?: number
  /** DB sidecar：本地缓存未命中的媒体数；不等于下载失败 */
  mediaCacheMisses?: number
  /** DB sidecar：原始 URL 成功取回真实媒体字节的数量 */
  mediaUrlHits?: number
  /** DB sidecar：原始 URL 已失效（HTTP 400/非媒体/占位图）的数量 */
  mediaUrlMisses?: number
  /** DB sidecar：原始 URL 网络异常的数量；与「票据失效」分开统计 */
  mediaUrlErrors?: number
  /** DB sidecar：本地缓存和原始 URL 都拿不到的真实媒体数量 */
  mediaUnavailable?: number
  /** DB sidecar：真正的下载异常数；占位图/HTTP 400 不计入这里 */
  mediaDownloadErrors?: number
  /** 结构化字段可得性；驱动未上报时缺省，此时按「只拿到正文」理解 */
  fields?: WechatMomentFieldAvailability
}

/** 归档里的一条动态：桥落盘/数据库落库后的稳定形态 */
export interface WechatMomentArchiveItemView {
  id: string
  /** 平台动态 id / 归档去重键；本地媒体接口必须用它，不能用数据库行 id */
  momentKey?: string
  authorId: string | null
  authorName: string
  authorResolved: boolean
  content: string
  mediaUrls: string[]
  createdAt: number | null
  source: string
  /** 首次抓到的时间（ISO） */
  firstSeenAt: string
  /** 最近一次抓到的时间（ISO） */
  lastSeenAt: string
  /** 被重复抓到的次数 */
  seenCount: number
  page?: number
  /** DB sidecar 真实点赞名单；OCR/UIA 归档时缺省 */
  likeUsers?: string[]
  /** DB sidecar 点赞者 wxid 名单 */
  likeUserIds?: string[]
  /** DB sidecar 真实评论结构；OCR/UIA 归档时缺省 */
  commentsData?: WechatMomentCommentView[]
  /** DB sidecar 本地媒体目录；媒体真实落盘时才有 */
  mediaLocalDir?: string
  /** 平台声明的媒体条目数；DB sidecar 抓取时写入，旧归档可能缺省 */
  mediaCount?: number
  /** 本地实际可读的媒体文件数；按磁盘真实文件统计，不是平台声明数 */
  mediaAvailableCount?: number
  /** 平台声明有、但本地没有真实文件的媒体数；这些原件已不可得 */
  mediaMissingCount?: number
  /** DB sidecar 是否至少落盘一个媒体 */
  mediaDownloaded?: boolean
  likes?: boolean
  comments?: boolean
}

/** 归档媒体总量统计；只统计真实落盘文件，不是平台声明数 */
export interface WechatMomentMediaStat {
  declared: number
  available: number
  missing: number
}

/** 归档查询结果；storage 说明这次读的是数据库还是桥本地 JSONL */
export interface WechatMomentArchiveView {
  storage: 'database' | 'bridge' | 'none'
  total: number
  moments: WechatMomentArchiveItemView[]
  limit: number
  /** 本页从第几条开始（0 基）；桥本地 JSONL 降级时固定为 0 */
  offset: number
  /** storage 非 database 时说明降级原因；正常为 null */
  reason: string | null
  /** 数据库来源时的全量媒体统计；桥降级或缺字段时缺省 */
  mediaStats?: WechatMomentMediaStat
}

/** 归档查询入参 */
export interface WechatMomentArchiveInput {
  /** 最多返回多少条，默认 50，上限 500 */
  limit?: number
  /** 从第几条开始，默认 0；配合 limit 翻页读完 715 条 */
  offset?: number
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

/**
 * 报告类型：annual 年度、pair 双人关系、group 群聊活跃。
 * 三者共用同一套结构化字段，前端可按 kind 决定展示顺序。
 */
export type WechatReportKind = 'annual' | 'pair' | 'group'

export interface WechatReportInput {
  kind: WechatReportKind
  /** annual 用自然年；不传取当前年。pair/group 也用它限定时间窗 */
  year?: number
  /** pair/group 必填 */
  conversationId?: string
  /** 报告时区，默认 Asia/Shanghai */
  timezone?: string
}

export interface WechatReportBucket {
  /** YYYY-MM-DD（按报告时区切日） */
  day: string
  count: number
}

export interface WechatReportParticipant {
  id: string
  name: string
  messageCount: number
  charCount: number
  /** 主动发起会话/话题次数（非回复首条） */
  initiations: number
}

export interface WechatReportResult {
  kind: WechatReportKind
  title: string
  accountId: string
  conversationId: string | null
  year: number
  timezone: string
  range: { startAt: string | null; endAt: string | null }
  stats: {
    messageCount: number
    inboundCount: number
    outboundCount: number
    charCount: number
    participantCount: number
    activeDays: number
    /** 最长连续聊天天数 */
    longestStreakDays: number
    /** 单日峰值 */
    peakDay: { day: string; count: number } | null
    /** 回复间隔中位数（秒），无成对消息时为 null */
    medianReplySeconds: number | null
  }
  participants: WechatReportParticipant[]
  hourly: number[]
  weekday: number[]
  daily: WechatReportBucket[]
  keywords: Array<{ word: string; count: number }>
  highlights: string[]
  /** 同一份数据的 Markdown 渲染，便于直接发给微信或存文档 */
  markdown: string
}

/** 自然语言问聊天记录 */
export interface WechatAskInput {
  question: string
  conversationId?: string
  /** 检索时间窗；不传按问题里的时间词推断，再不行取最近 7 天 */
  since?: string
  until?: string
  /** 单次取多少条上下文，默认 40，上限 100 */
  limit?: number
  model?: string
}

export interface WechatAskCitation {
  messageId: string
  conversationTitle: string
  senderName: string | null
  sentAt: string
  snippet: string
}

export interface WechatAskResult {
  answer: string
  citations: WechatAskCitation[]
  /** 解析出的检索条件，便于前端解释“为什么是这些消息” */
  plan: {
    since: string | null
    until: string | null
    keywords: string[]
    senderName: string | null
    /** 命中统计意图时给出类型，例如 sender-rank / day-peak / count */
    intent?: string | null
  }
  /** 统计意图下的结构化结果，可直接拿去画图或二次计算 */
  stats?: Record<string, unknown> | null
  generatedBy: 'llm' | 'local'
}

/**
 * 「让 AI 写一条查询」的结果。
 *
 * 模型只写 WHERE / 聚合表达式，表名被强制固定成一个只含本账号消息的 CTE，
 * 语句在只读校验通过后才执行，最多回 50 行。sql 原样展示给用户，
 * 让人能看见「它到底查了什么」，而不是只给一个黑箱数字。
 */
export interface WechatAskSqlResult {
  answer: string
  sql: string
  rowCount: number
  rows: Array<Record<string, unknown>>
  generatedBy: 'llm' | 'local'
  /** 校验没过 / 执行出错 / 模型没给出 SQL 时的中文原因；正常为 null */
  note: string | null
}

/** 定时任务类型：定时群发 / 定时报告 / 定时朋友圈 / 定时语音转写 */
export type WechatJobKind = 'broadcast' | 'report' | 'moment' | 'transcribe'

export interface WechatJobPayload {
  /** broadcast / moment：正文；与 mediaUrl 二选一即可 */
  text?: string
  mediaUrl?: string
  /** moment：多图/多视频地址 */
  mediaUrls?: string[]
  /** 显式目标；为空时按 tags 圈选 */
  targets?: string[]
  tags?: string[]
  /** report：报告范围 */
  reportKind?: 'annual' | 'pair' | 'group'
  year?: number
  conversationId?: string
  /** transcribe：这一轮最多扫多少条语音（服务端再夹到 1–50） */
  limit?: number
}

export interface WechatJobView {
  id: string
  kind: WechatJobKind
  enabled: boolean
  /** 0-23 */
  hour: number
  /** 0-59 */
  minute: number
  timezone: string
  /** 0=周日 … 6=周六；null 表示每天 */
  weekly: number | null
  payload: WechatJobPayload
  lastRunAt: string | null
  lastRunDay: string | null
  createdAt: string
}

export interface WechatJobInput {
  id?: string
  kind: WechatJobKind
  enabled?: boolean
  hour?: number
  minute?: number
  timezone?: string
  weekly?: number | null
  payload: WechatJobPayload
}

export interface WechatJobRunResult {
  jobId: string
  kind: WechatJobKind
  ok: boolean
  detail: string
  at: string
}

/** 单条语音转写结果；stub=true 表示 STT 未真正可用，文本未写库 */
export interface WechatVoiceTranscribeResult {
  messageId: string
  text: string
  model: string
  stub: boolean
  chars: number
}

export interface WechatVoiceTranscribeBatchItem {
  messageId: string
  ok: boolean
  text: string | null
  error: string | null
}

export interface WechatVoiceTranscribeBatchResult {
  scanned: number
  transcribed: number
  failed: number
  skipped: number
  /** 本次扫描后该账号仍未转写的语音条数；前端据此决定要不要再跑一轮，避免一次请求跑成超时。 */
  remaining: number
  /**
   * 本次是否碰到 STT 引擎未就绪（返回 stub）。
   * true 时 remaining 不会因为这一轮而下降，前端必须立刻停止继续轮询，否则只是空转。
   */
  stub: boolean
  items: WechatVoiceTranscribeBatchItem[]
}

/** 斜杠指令视图（前端指令面板） */
export interface WechatCommandView {
  name: string
  aliases: string[]
  description: string
  /** 是否需要在群里 @ 才响应 */
  scope: 'all' | 'private' | 'group'
  enabled: boolean
}

export interface WechatCommandRunResult {
  command: string
  replyText: string
  /** 出站投递状态，与 WechatSendStatus 同值域 */
  deliveryStatus: string
  /** 标记是否由指令而非自动回复规则产生 */
  handledByCommand: true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
