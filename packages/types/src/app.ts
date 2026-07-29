/**
 * 跨端 app 组件类型契约 — @ihui/types
 *
 * 从 packages/app/src/types.ts 迁移而来(2026-07-25),作为单一来源。
 * web/miniapp-taro 可直接 `import type { SharedUser } from '@ihui/types'`,
 * 无需安装 @ihui/rn-app(后者有 react-native peerDep)。
 * packages/app/src/types.ts 改为 re-export 本文件,保持向后兼容(mobile-rn 不受影响)。
 *
 * 平台无关的 props 契约,RN/web wrapper 通过 props 注入平台实现
 * (i18n t 函数、导航、API 调用、Alert/Confirm 弹窗等),
 * 共享组件只负责纯 UI 渲染,不直接依赖任何平台 API。
 */

/** i18n 翻译函数契约(兼容 next-intl / i18next / 自定义) */
export type TFunction = (key: string, options?: Record<string, string | number>) => string

/** 用户信息(平台注入,字段对齐 mobile-rn useAuth + web useUser) */
export interface SharedUser {
  id: string | number
  nickname?: string
  avatar?: string | null
  email?: string
  phone?: string
}

/** 用户统计(平台注入,字段对齐 mobile-rn getUserStatistics 返回) */
export interface SharedUserStatistics {
  courseCount?: number
  favoriteCount?: number
  followingCount?: number
  fansCount?: number
  studyHours?: number
  points?: number
}

/** 菜单项(个人页/设置页通用) */
export interface SharedMenuItem {
  key: string
  label: string
  icon?: string
}

/** 菜单分组(个人页多 section 列表) */
export interface SharedMenuSection {
  title: string
  items: SharedMenuItem[]
}

/** 语言选项(设置页语言切换) */
export interface SharedLocaleOption {
  value: string
  label: string
}

/** 主题选项(设置页主题切换) */
export interface SharedThemeOption {
  value: string
  label: string
}

/** 应用信息(About 页展示) */
export interface SharedAppInfo {
  appName?: string
  version?: string
  description?: string
  officialSite?: string
  contactEmail?: string
  license?: string
}

/** 通知开关状态(设置页) */
export interface SharedNotificationToggles {
  push: boolean
  message: boolean
  email: boolean
}

/** About 屏 props */
export interface AboutScreenProps {
  t: TFunction
  appInfo?: SharedAppInfo
  onBack: () => void
}

/** Profile 屏 props */
export interface ProfileScreenProps {
  t: TFunction
  user?: SharedUser | null
  stats?: SharedUserStatistics | null
  orderCount?: number
  loading?: boolean
  error?: string
  menuSections?: SharedMenuSection[]
  onNavigate?: (key: string) => void
  onLogout?: () => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light'。web 端不传即保持浅色行为 */
  colorScheme?: 'light' | 'dark'
}

/** Settings 屏 props */
export interface SettingsScreenProps {
  t: TFunction
  user?: SharedUser | null
  locale: string
  localeOptions: SharedLocaleOption[]
  onSelectLocale: (value: string) => void
  theme: string
  themeOptions: SharedThemeOption[]
  onSelectTheme: (value: string) => void
  notifications: SharedNotificationToggles
  onToggleNotification: (key: keyof SharedNotificationToggles, value: boolean) => void
  onEditProfile?: () => void
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<boolean>
  onAlert: (title: string, message?: string) => void
  onConfirm: (title: string, message: string, onOk: () => void) => void
  onLogout: () => void
  menuItems: SharedMenuItem[]
  onMenuPress: (key: string) => void
  appVersion?: string
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light'。web 端不传即保持浅色行为 */
  colorScheme?: 'light' | 'dark'
}

/** 反馈类型(与后端 /api/feedbacks 契约对齐) */
export type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other'

/** Feedback 屏提交载荷 */
export interface FeedbackSubmitPayload {
  type: FeedbackType
  content: string
  contact: string
}

/** Feedback 屏 props */
export interface FeedbackScreenProps {
  t: TFunction
  /** 提交回调,返回 true 表示成功(平台注入实际 API 调用) */
  onSubmit: (payload: FeedbackSubmitPayload) => Promise<boolean>
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 反馈状态(与后端 /api/feedbacks 契约对齐) */
export type FeedbackStatus = 'pending' | 'resolved' | 'closed'

/** 反馈历史列表项(平台注入,字段对齐 mobile-rn FeedbackHistoryScreen Item) */
export interface FeedbackHistoryItem {
  id: string
  type: FeedbackType | string
  status: FeedbackStatus | string
  content: string
  createdAt: string
}

/** FeedbackHistory 屏 props */
export interface FeedbackHistoryScreenProps {
  t: TFunction
  items: FeedbackHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击列表项回调,平台注入导航跳转(如 navigate('FeedbackDetail', { id })) */
  onPressItem: (id: string) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 收藏对象类型(与后端 /api/favorites 契约对齐,targetType 字段对齐 FavoriteItem) */
export type BookmarkTargetType = 'course' | 'article' | 'post' | 'note' | string

/** 收藏列表项(平台注入,字段对齐 @ihui/api-client FavoriteItem) */
export interface BookmarkItem {
  id: string
  targetId: string
  targetType: BookmarkTargetType
  title: string
  /** 封面图 URL(可空) */
  cover?: string | null
  /** ISO 时间字符串或格式化后的时间文本 */
  createdAt: string
}

/** Bookmark 屏 props */
export interface BookmarkScreenProps {
  t: TFunction
  items: BookmarkItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击列表项回调,平台注入导航跳转(参数为 BookmarkItem 完整对象,平台依据 targetType 决定目标路由) */
  onPressItem: (item: BookmarkItem) => void
  /** 删除收藏回调,平台注入实际 API 调用 + 列表状态更新 */
  onRemove: (item: BookmarkItem) => void | Promise<void>
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 通知类型(与后端 /api/notifications 契约对齐) */
export type NotificationType = 'system' | 'order' | 'course' | 'social' | string

/** 通知列表项(平台注入,字段对齐 mobile-rn NotificationListScreen Notif) */
export interface NotificationListItem {
  id: string
  type: NotificationType
  title: string
  content: string
  /** 是否已读(未读用 success 色 border + 浅色背景) */
  read: boolean
  createdAt: string
}

/** NotificationList 屏 props */
export interface NotificationListScreenProps {
  t: TFunction
  items: NotificationListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击通知卡片回调,可选(原 RN 实现无点击跳转,wrapper 可不传) */
  onPressItem?: (item: NotificationListItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 浏览历史对象类型(与后端 /api/history 契约对齐) */
export type HistoryTargetType = 'course' | 'article' | 'post' | 'note' | 'live' | string

/** 浏览历史列表项(平台注入,字段对齐 mobile-rn HistoryScreen HistoryItem) */
export interface HistoryItem {
  id: string
  targetId: string
  targetType: HistoryTargetType
  title: string
  /** 访问时间(ISO 或格式化后字符串) */
  visitedAt: string
}

/** History 屏 props */
export interface HistoryScreenProps {
  t: TFunction
  items: HistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击列表项回调,平台注入导航跳转(参数为 HistoryItem 完整对象,平台依据 targetType 决定目标路由) */
  onPressItem: (item: HistoryItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 证书状态(与后端 /api/certificates 契约对齐) */
export type CertificateStatus = 'issued' | 'expired' | 'revoked' | string

/** 证书列表项(平台注入,字段对齐 @ihui/api-client CertificateItem) */
export interface CertificateItem {
  id: string
  /** 证书标题 */
  title: string
  /** 课程名 */
  courseName: string
  /** 发证日期(ISO 字符串或已格式化文本) */
  issueDate: string
  /** 过期日期(可空,表示永久有效) */
  expiryDate: string | null
  /** 证书状态 */
  status: CertificateStatus
}

/** Certificate 屏 props */
export interface CertificateScreenProps {
  t: TFunction
  items: CertificateItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击证书卡片回调,平台注入导航跳转(如 navigate('CertificateDetail', { id })) */
  onPressItem: (item: CertificateItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 消息中心 Tab key(可扩展为任意 string) */
export type MessageTab = 'system' | 'order' | 'course' | 'social' | (string & {})

/** 消息项(平台注入,字段对齐 mobile-rn MessageCenterScreen Message) */
export interface MessageCenterItem {
  id: string
  type: MessageTab
  title: string
  content: string
  /** 是否已读 */
  read: boolean
  createdAt: string
}

/** 消息中心共享屏 props */
export interface MessageCenterScreenProps {
  t: TFunction
  items: MessageCenterItem[]
  /** 当前激活 tab */
  activeTab: MessageTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: MessageTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击消息卡片回调,可选 */
  onPressItem?: (item: MessageCenterItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/**
 * 订单状态(用户端共享屏展示子集,与后端 /api/orders 契约对齐)。
 *
 * 注意:admin-types.ts 的 `OrderStatus` 是后台完整状态机(7 值含 refunding/failed),
 * 此处 `AppOrderStatus` 是用户端展示子集(含 shipped 实物发货),两者语义不同,
 * 故加 `App` 前缀避免 `export *` 冲突。
 */
export type AppOrderStatus =
  'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded' | string

/** 订单 Tab */
export type OrderTab = 'all' | 'pending' | 'paid' | 'shipped' | 'completed' | string

/** 订单列表项(平台注入,字段对齐 mobile-rn OrderScreen Order) */
export interface OrderItem {
  id: string
  orderNo: string
  title: string
  amount: number
  status: AppOrderStatus
  createdAt: string
}

/** Order 屏 props */
export interface OrderScreenProps {
  t: TFunction
  items: OrderItem[]
  /** 当前激活 tab */
  activeTab: OrderTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: OrderTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击订单卡片回调,平台注入导航跳转 */
  onPressItem: (item: OrderItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 学习计划状态 */
export type PlanStatus = 'active' | 'paused' | 'completed' | 'overdue' | string

/** 学习计划列表项(平台注入,字段对齐 mobile-rn StudyPlanScreen StudyPlan) */
export interface StudyPlanItem {
  id: string
  title: string
  courseName: string
  /** 总课时数 */
  totalLessons: number
  /** 已完成课时数 */
  completedLessons: number
  /** 学习进度(0-100,百分比) */
  progress: number
  status: PlanStatus
  /** 截止日期(ISO 或格式化字符串) */
  deadline: string
}

/** StudyPlan 屏 props */
export interface StudyPlanScreenProps {
  t: TFunction
  items: StudyPlanItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击计划卡片回调,平台注入导航跳转 */
  onPressItem: (item: StudyPlanItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 钱包余额信息(平台注入,字段对齐 @ihui/api-client WalletBalance) */
export interface WalletBalance {
  /** 可用余额 */
  balance: number
  /** 冻结金额 */
  frozenBalance: number
  /** 累计充值 */
  totalRecharge: number
  /** 累计提现 */
  totalWithdraw: number
}

/** 钱包记录类型(与后端 /api/wallet/records 契约对齐) */
export type WalletRecordType =
  'recharge' | 'withdraw' | 'consume' | 'refund' | 'commission' | string

/** 钱包记录列表项(平台注入) */
export interface WalletRecordItem {
  id: string
  amount: number
  balanceAfter: number
  type: WalletRecordType
  status: string
  payMethod: string | null
  remark: string | null
  createdAt: string
}

/** Wallet 屏 props */
export interface WalletScreenProps {
  t: TFunction
  balance: WalletBalance | null
  loading: boolean
  error: string
  onRefresh: () => void
  /** 点击充值/提现等操作回调,平台注入导航跳转 */
  onAction?: (action: 'recharge' | 'withdraw') => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 课程目录项(平台注入,字段对齐 mobile-rn CourseCatalogScreen CatalogItem) */
export interface CourseCatalogItem {
  id: string
  title: string
  type: string
  /** 时长(分钟) */
  duration: number
  /** 子章节(可选,用于树形目录) */
  children?: CourseCatalogItem[]
}

/** CourseCatalog 屏 props */
export interface CourseCatalogScreenProps {
  t: TFunction
  items: CourseCatalogItem[]
  loading: boolean
  error: string
  /** 点击章节回调,平台注入导航跳转(如 navigate('CourseChapter', { id })) */
  onPressItem: (item: CourseCatalogItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

// ============================================================
// 第三批共享屏类型(2026-07-29):PointHistory/NoteList/ArticleList/
// Announcement/LivePlaybackList/RefundHistory/CourseQAList
// ============================================================

/** 积分历史列表项(平台注入,字段对齐 mobile-rn PointHistoryScreen Item) */
export interface PointHistoryItem {
  id: string
  /** 操作描述(如"签到"/"消费") */
  action: string
  /** 积分变动(正数获得,负数消耗) */
  points: number
  /** 变动后余额 */
  balance: number
  /** ISO 时间字符串或格式化后的时间文本 */
  createdAt: string
}

/** PointHistory 屏 props */
export interface PointHistoryScreenProps {
  t: TFunction
  items: PointHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 笔记列表项(平台注入,字段对齐 mobile-rn NoteListScreen Note) */
export interface NoteListItem {
  id: string
  title: string
  summary: string
  author: string
  likes: number
  createdAt: string
}

/** NoteList 屏 props */
export interface NoteListScreenProps {
  t: TFunction
  items: NoteListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击笔记卡片回调,平台注入导航跳转 */
  onPressItem: (item: NoteListItem) => void
  /** 新建笔记回调(可选,平台注入导航跳转) */
  onCreate?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 文章列表项(平台注入,字段对齐 mobile-rn ArticleListScreen Article) */
export interface ArticleListItem {
  id: string
  title: string
  author: string
  views: number
  publishedAt: string
  /** 封面图 URL(可空) */
  cover?: string
}

/** ArticleList 屏 props */
export interface ArticleListScreenProps {
  t: TFunction
  items: ArticleListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击文章卡片回调,平台注入导航跳转 */
  onPressItem: (item: ArticleListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 公告列表项(平台注入,字段对齐 mobile-rn AnnouncementScreen Announcement) */
export interface AnnouncementItem {
  id: string
  title: string
  content: string
  /** 发布时间(ISO 或格式化字符串) */
  publishTime: string
  /** 是否置顶 */
  pinned: boolean
}

/** Announcement 屏 props */
export interface AnnouncementScreenProps {
  t: TFunction
  items: AnnouncementItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击公告卡片回调,平台注入导航跳转 */
  onPressItem: (item: AnnouncementItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 直播回放列表项(平台注入,字段对齐 mobile-rn LivePlaybackListScreen Item) */
export interface LivePlaybackItem {
  id: string
  title: string
  lecturer: string
  /** 时长(秒) */
  duration: number
  viewerCount: number
  createdAt: string
}

/** LivePlaybackList 屏 props */
export interface LivePlaybackListScreenProps {
  t: TFunction
  items: LivePlaybackItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击回放卡片回调,平台注入导航跳转 */
  onPressItem: (item: LivePlaybackItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 退款状态(用户端共享屏展示子集,与后端 /api/refund 契约对齐)。
 * 注意:admin-types.ts 的 `RefundStatus` 是后台完整状态机,此处 `AppRefundStatus` 是用户端展示子集,
 * 加 `App` 前缀避免 `export *` 冲突(同 `AppOrderStatus` 模式)。
 */
export type AppRefundStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | string

/** 退款历史列表项(平台注入,字段对齐 mobile-rn RefundHistoryScreen Item) */
export interface RefundHistoryItem {
  id: string
  amount: number
  status: AppRefundStatus
  reason: string
  createdAt: string
}

/** RefundHistory 屏 props */
export interface RefundHistoryScreenProps {
  t: TFunction
  items: RefundHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击退款卡片回调,平台注入导航跳转 */
  onPressItem: (item: RefundHistoryItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程问答列表项(平台注入,字段对齐 mobile-rn CourseQAListScreen Item) */
export interface CourseQAListItem {
  id: string
  question: string
  asker: string
  answerCount: number
  createdAt: string
}

/** CourseQAList 屏 props */
export interface CourseQAListScreenProps {
  t: TFunction
  items: CourseQAListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击问答卡片回调,平台注入导航跳转 */
  onPressItem: (item: CourseQAListItem) => void
  /** 提问回调(可选,平台注入导航跳转) */
  onAsk?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 详情屏(批次 7,2026-07-29) ============

/** 笔记详情(平台注入,字段对齐 mobile-rn NoteDetailScreen Note) */
export interface NoteDetailItem {
  id: string
  title: string
  content: string
  createdAt: string
  tags: string[]
  views: number
  likes: number
  author: string
}

/** NoteDetail 屏 props */
export interface NoteDetailScreenProps {
  t: TFunction
  item: NoteDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 文章详情(平台注入,字段对齐 mobile-rn ArticleDetailScreen Article) */
export interface ArticleDetailItem {
  id: string
  title: string
  content: string
  author: string
  cover?: string
  views: number
  likes: number
  publishedAt: string
}

/** ArticleDetail 屏 props */
export interface ArticleDetailScreenProps {
  t: TFunction
  item: ArticleDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 帮助详情(平台注入,字段对齐 mobile-rn HelpDetailScreen Detail) */
export interface HelpDetailItem {
  id: string
  question: string
  answer: string
  category: string
}

/** HelpDetail 屏 props */
export interface HelpDetailScreenProps {
  t: TFunction
  item: HelpDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 反馈详情(平台注入,字段对齐 mobile-rn FeedbackDetailScreen Detail) */
export interface FeedbackDetailItem {
  id: string
  type: string
  content: string
  status: string
  reply: string
  createdAt: string
}

/** FeedbackDetail 屏 props */
export interface FeedbackDetailScreenProps {
  t: TFunction
  item: FeedbackDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 批次 8:静态屏+列表屏+详情屏(2026-07-29) ============

/** Privacy 屏 props(纯静态展示,无 API) */
export interface PrivacyScreenProps {
  t: TFunction
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agreement 屏 props(纯静态展示,无 API) */
export interface AgreementScreenProps {
  t: TFunction
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分规则列表项(平台注入,字段对齐 mobile-rn PointRuleScreen Item) */
export interface PointRuleItem {
  id: string
  action: string
  points: number
  desc: string
}

/** PointRule 屏 props */
export interface PointRuleScreenProps {
  t: TFunction
  items: PointRuleItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 等级详情(平台注入,字段对齐 mobile-rn VipLevelScreen Detail) */
export interface VipLevelItem {
  id: string
  levelName: string
  price: number
  durationDays: number
  benefits: string
}

/** VipLevel 屏 props */
export interface VipLevelScreenProps {
  t: TFunction
  item: VipLevelItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 退款详情(平台注入,字段对齐 mobile-rn RefundDetailScreen Detail) */
export interface RefundDetailItem {
  id: string
  orderNo: string
  amount: number
  status: string
  reason: string
  createdAt: string
}

/** RefundDetail 屏 props */
export interface RefundDetailScreenProps {
  t: TFunction
  item: RefundDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 订单详情(平台注入,字段对齐 mobile-rn OrderDetailScreen OrderDetail) */
export interface OrderDetailItem {
  id: string
  orderNo: string
  amount: number
  status: string
  productName: string
  createdAt: string
  paidAt?: string
}

/** OrderDetail 屏 props */
export interface OrderDetailScreenProps {
  t: TFunction
  item: OrderDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 证书详情(平台注入,字段对齐 mobile-rn CertDetailScreen Cert) */
export interface CertDetailItem {
  id: string
  certNo: string
  title: string
  issuer: string
  holder: string
  issuedAt: string
  expiredAt?: string
  score: number
  verifyUrl: string
}

/** CertDetail 屏 props */
export interface CertDetailScreenProps {
  t: TFunction
  item: CertDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  /** 验证证书回调(平台注入导航跳转) */
  onVerify?: (certNo: string) => void
  colorScheme?: 'light' | 'dark'
}

/** 动态详情(平台注入,字段对齐 mobile-rn PostDetailScreen Post) */
export interface PostDetailItem {
  id: string
  title: string
  content: string
  author: string
  circleName?: string
  likes: number
  comments: number
  createdAt: string
}

/** PostDetail 屏 props */
export interface PostDetailScreenProps {
  t: TFunction
  item: PostDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 公告详情(平台注入,字段对齐 mobile-rn AnnouncementDetailScreen Detail) */
export interface AnnouncementDetailItem {
  id: string
  title: string
  content: string
  author: string
  publishTime: string
}

/** AnnouncementDetail 屏 props */
export interface AnnouncementDetailScreenProps {
  t: TFunction
  item: AnnouncementDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 法律文档章节(隐私政策/用户协议等通用静态页) */
export interface LegalDocSection {
  title: string
  body: string
}

/** LegalDoc 屏 props(通用静态页:隐私/协议/Cookie 政策等) */
export interface LegalDocScreenProps {
  t: TFunction
  title: string
  subtitle: string
  updatedAt: string
  sections: LegalDocSection[]
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 帮助列表项(平台注入,字段对齐 mobile-rn HelpScreen) */
export interface HelpListItem {
  id: string
  question: string
  answer: string
}

/** HelpScreen(帮助列表)props */
export interface HelpScreenProps {
  t: TFunction
  items: HelpListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  expandedId: string | null
  onRefresh: () => void
  onToggle: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
