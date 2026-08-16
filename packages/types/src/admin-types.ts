/**
 * Admin 后台业务类型契约(2026-07-28 立)
 *
 * 来源:从 apps/web/app/(main)/admin 下 9 个 types.ts 文件下沉的通用业务类型。
 * 命名策略:
 *  - 与 packages/types 已有类型(legacy-migration.ts 的 Article / News)冲突的,加业务前缀
 *    (AdminArticle / NewsArticle / NewsInformation 等);
 *  - 与 @ihui/api-client 已有同名但语义不同的类型(api-client/learn.ts Member / MemberLevel、
 *    api-client/resource.ts Resource、api-client/system.ts Category、api-client/agent.ts
 *    Agent / AgentStatus)冲突的,加业务前缀(AdminMember / AdminMemberLevel / AdminResource /
 *    AdminCategory / CsAgent / CsAgentStatus);
 *  - 无冲突的保留原名(OrderStatus / RefundStatus / EduOrder / InvoiceTitle / WithdrawalItem 等)。
 *
 * 各 admin types.ts 通过 `export type { AdminArticle as Article, ... } from '@ihui/types'`
 * 保持外部引用名称不变。
 */

// ===================== 订单 / 退款 / 发票(orders) =====================

/**
 * 订单状态。
 * 必须与 @ihui/api-client endoints/order.ts 的 OrderStatus 对齐(7 值完整枚举)。
 * admin/orders/types.ts 原仅 4 值(pending/paid/cancelled/refunded),此处采用完整枚举。
 */
export type OrderStatus =
  'pending' | 'paid' | 'cancelled' | 'refunding' | 'refunded' | 'completed' | 'failed'

/** 退款状态(6 值,与 @ihui/api-client endpoints/payment.ts RefundStatus 同集合) */
export type RefundStatus =
  'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'

/** 发票申请状态 */
export type InvoiceAppStatus =
  'pending' | 'approved' | 'rejected' | 'invoicing' | 'invoiced' | 'canceled'

/** 教务订单(admin/orders EduOrder) */
export interface EduOrder {
  id: string
  orderNo: string
  userId: string
  orderType: string
  targetId?: string | null
  targetTitle?: string | null
  quantity: number
  originalPrice: string
  discountAmount: string
  payAmount: string
  payType?: string | null
  status: OrderStatus
  payTime?: string | null
  cancelTime?: string | null
  refundTime?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
}

/** 教务退款申请(admin/orders EduRefund) */
export interface EduRefund {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason?: string | null
  refundAmount: string
  refundType: string
  status: RefundStatus
  applyTime?: string | null
  processTime?: string | null
  completeTime?: string | null
  processMessage?: string | null
  handleMessage?: string | null
  createdAt: string
  updatedAt: string
}

/** 发票申请(admin/orders EduInvoiceApplication) */
export interface EduInvoiceApplication {
  id: string
  orderId?: string | null
  userId: string
  invoiceType: string
  titleId?: string | null
  amount: string
  email?: string | null
  status: InvoiceAppStatus
  remark?: string | null
  createdAt: string
  updatedAt: string
}

// ===================== 文章(articles) =====================

/** 文章状态(admin/articles ArticleStatus) */
export type ArticleStatus = 'draft' | 'published'

/**
 * 文章(admin/articles Article)。
 * 与 legacy-migration.ts Article 字段集不同(无索引签名、status 为 ArticleStatus 而非通用),
 * 故以 AdminArticle 命名下沉,admin/articles/types.ts re-export 为 Article。
 */
export interface AdminArticle {
  id: string
  title: string
  authorName?: string | null
  categoryName?: string | null
  status: ArticleStatus
  viewCount: number
  createdAt: string
  summary?: string | null
  content?: string
}

/** 文章列表响应(admin/articles ArticlesData) */
export interface AdminArticlesData {
  list: AdminArticle[]
  total: number
}

// ===================== 资讯 / 文章(news) =====================

/**
 * 资讯频道文章(admin/news Article)。
 * 字段集与 admin/articles Article 差异较大(status: number、含 categoryId/isPublished/isPinned/sort 等),
 * 单独以 NewsArticle 命名下沉,admin/news/types.ts re-export 为 Article。
 */
export interface NewsArticle {
  id: string
  categoryId: string | null
  title: string
  summary: string | null
  content: string
  coverImage: string | null
  authorId: string | null
  authorName: string | null
  isPublished: boolean
  isPinned: boolean
  viewCount: number
  sort: number
  status: number
  publishedAt: string | null
  createdAt: string
  categoryName?: string | null
}

/** 资讯频道文章列表响应(admin/news ArticlesData) */
export interface NewsArticlesData {
  list: NewsArticle[]
  total: number
  page: number
  pageSize: number
}

/**
 * 通用 admin 分类(admin/news、admin/live、admin/resources 共享,{id,name,sort,status})。
 * 与 @ihui/api-client endpoints/system.ts Category 字段不同,以 AdminCategory 命名下沉。
 */
export interface AdminCategory {
  id: string
  name: string
  sort: number
  status: number
}

/** 资讯条目(admin/news Information) */
export interface NewsInformation {
  id: string
  title: string
  content: string
  type: string | null
  url: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourceCreator: string | null
  sourceTime: string | null
  insertTime: string | null
  browse: number | null
  creator: string | null
  crearedTime: string | null
}

/** 资讯条目列表响应(admin/news InfoData) */
export interface NewsInfoData {
  list: NewsInformation[]
  total: number
  page: number
  pageSize: number
}

// ===================== 会员(members) =====================

/**
 * 会员(admin/members Member)。
 * 与 @ihui/api-client endpoints/learn.ts Member 字段不同(无 userId/level/points,含 username/mobile/email 等),
 * 以 AdminMember 命名下沉。
 */
export interface AdminMember {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  avatar: string | null
  nickname: string | null
  gender: number
  status: number
  levelId: string | null
  companyId: string | null
  departmentId: string | null
  growthValue: number
  createdAt: string
}

/** 会员列表响应(admin/members MembersData) */
export interface AdminMembersData {
  list: AdminMember[]
  total: number
  page: number
  pageSize: number
}

/** 会员统计(admin/members MemberStatistics) */
export interface AdminMemberStatistics {
  total: number
  active: number
  pending: number
  sealed: number
}

/**
 * 会员等级(admin/members MemberLevel)。
 * 与 @ihui/api-client endpoints/learn.ts MemberLevel 字段不同,以 AdminMemberLevel 命名下沉。
 */
export interface AdminMemberLevel {
  id: string
  name: string
  growthValue: number
  discount: string
  sort: number
}

/** 公司列表响应(admin/members CompaniesData,list 元素后端结构未定) */
export interface AdminCompaniesData {
  list: unknown[]
  total: number
  page: number
  pageSize: number
}

/** 会员批量导入结果项(admin/members ImportResultItem) */
export interface AdminImportResultItem {
  serialNum: number
  rowNum: number
  success: boolean
  message: string
  companyName?: string
  memberName?: string
  memberMobile?: string
  postName?: string
  lessonName?: string
}

/** 会员批量导入结果(admin/members ImportResult) */
export interface AdminImportResult {
  successCount: number
  failureCount: number
  resultItemList: AdminImportResultItem[]
}

// ===================== 直播(live) =====================

/** 直播频道(admin/live Channel) */
export interface LiveChannel {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  introduction: string | null
  cidList: string[] | null
  showNumber: number | null
  enableChat: boolean | null
  categoryId: string | null
  categoryName: string | null
  lecturerId: string | null
  lecturerName: string | null
  pushUrl: string | null
  playUrl: string | null
  startTime: string | null
  endTime: string | null
  isLive: boolean
  isPublished: boolean
  sort: number
  status: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

/** 直播频道列表响应(admin/live ChannelsData) */
export interface LiveChannelsData {
  list: LiveChannel[]
  total: number
  page: number
  pageSize: number
}

/** 讲师(admin/live Lecturer) */
export interface LiveLecturer {
  id: string
  name: string
  title: string | null
  sort: number
  status: number
}

/** 直播统计(admin/live LiveStatistics) */
export interface LiveStatistics {
  total: number
  living: number
  published: number
  viewSum: number
}

// ===================== 客服(customer-service) =====================

/** 工单状态(admin/customer-service TicketStatus) */
export type CsTicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'

/** 工单优先级(admin/customer-service TicketPriority) */
export type CsTicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * 客服坐席状态(admin/customer-service AgentStatus)。
 * 与 @ihui/api-client endpoints/agent.ts AgentStatus(发布流程)语义完全不同,
 * 以 CsAgentStatus 命名下沉。
 */
export type CsAgentStatus = 'online' | 'busy' | 'away' | 'offline'

/** 客服分类(admin/customer-service Category,字段与 AdminCategory 不同) */
export interface CsCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  sortOrder: number
}

/** 工单(admin/customer-service Ticket) */
export interface CsTicket {
  id: string
  ticketNo: string
  userId: string
  categoryId: string | null
  title: string
  description: string
  status: CsTicketStatus
  priority: CsTicketPriority
  assigneeId: string | null
  source: string
  attachments: unknown[]
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 工单评论(admin/customer-service Comment) */
export interface CsTicketComment {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

/** 客服坐席(admin/customer-service Agent) */
export interface CsAgent {
  id: string
  userId: string
  nickname: string
  avatar: string | null
  status: CsAgentStatus
  maxConcurrent: number
  currentLoad: number
  skills: string[]
  createdAt: string
}

/**
 * 客服会话(admin/customer-service CsSession)。
 * messages 字段引用 web 端组件本地类型 CsMessage,此处用 unknown[] 占位,
 * admin/customer-service/types.ts 仍保留本地 CsSession 覆盖(messages 类型精确为 CsMessage[])。
 */
export interface CsSessionBase {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  lastMessage: string
  lastTime: string
  unread: number
  messages: unknown[]
}

/** 客服统计(admin/customer-service CsStats) */
export interface CsStats {
  onlineAgents: number
  waiting: number
  todayProcessed: number
}

/** 客服会话列表响应(admin/customer-service SessionsData) */
export type CsSessionsData = { list: CsSessionBase[] } | CsSessionBase[]

// ===================== 发票抬头(invoices/titles) =====================

/** 发票抬头(admin/invoices/titles InvoiceTitle) */
export interface InvoiceTitle {
  id: string
  titleName: string
  taxNo: string
  titleType: 'company' | 'personal'
  bankName?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
  isDefault: boolean
  createdAt: string
}

/** 发票抬头列表响应(admin/invoices/titles TitlesData) */
export interface InvoiceTitlesData {
  list: InvoiceTitle[]
  total: number
}

// ===================== 资源(resources) =====================

/**
 * 资源(admin/resources Resource)。
 * 与 @ihui/api-client endpoints/resource.ts Resource 字段集不同(无索引签名、字段更具体),
 * 以 AdminResource 命名下沉。
 */
export interface AdminResource {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  categoryName: string | null
  fileUrl: string | null
  fileType: string | null
  fileSize: number | null
  isPublished: boolean
  sort: number
  status: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

/** 资源列表响应(admin/resources ResourcesData) */
export interface AdminResourcesData {
  list: AdminResource[]
  total: number
  page: number
  pageSize: number
}

// ===================== 提现(shop/withdrawals) =====================

/** 提现渠道(admin/shop/withdrawals WithdrawalItem['channel']) */
export type WithdrawalChannel = 'alipay' | 'wechat' | 'bank'

/** 提现状态(admin/shop/withdrawals WithdrawalItem['status']) */
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'

/** 提现申请项(admin/shop/withdrawals WithdrawalItem) */
export interface WithdrawalItem {
  id: string
  user: string
  userName?: string
  amount: number
  channel: WithdrawalChannel
  account: string
  status: WithdrawalStatus
  createdAt: string
  reviewer?: string
  reviewerTime?: number
  outBillNo?: string
  notes?: string
  weChatMsg?: string
  withdrawalTime?: number
  auditAmount?: number
}

/** 提现流水项(admin/shop/withdrawals WithdrawalFlowItem) */
export interface WithdrawalFlowItem {
  id: string
  userId: string
  amount: number
  outBillNo: string
  status: number
  createdAt: string
  updatedAt: string
  transferDetail: string
}

/** 通用列表响应(admin/shop/withdrawals ListData<T>) */
export interface AdminListData<T> {
  list: T[]
  total: number
}
