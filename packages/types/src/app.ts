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

/** 搜索结果项(平台注入,字段对齐 mobile-rn SearchScreen) */
export interface SearchScreenItem {
  id: string
  title: string
  summary: string
  type: 'course' | 'article' | 'post' | 'note' | 'agent'
  cover?: string
}

/** SearchScreen props */
export interface SearchScreenProps {
  t: TFunction
  keyword: string
  results: SearchScreenItem[]
  loading: boolean
  error: string
  searched: boolean
  onKeywordChange: (text: string) => void
  onSearch: () => void
  onPressItem: (item: SearchScreenItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 9:Agent/问答/证书/提现/VIP 对比/分享(2026-07-29) */

/** Agent 详情(平台注入,字段对齐 mobile-rn AgentDetailScreen) */
export interface AgentDetailItem {
  id: string
  name: string
  description: string
  avatar?: string
  uses: number
  rating: number
  category: string
  creator: string
  isFree: boolean
  price: number
}

/** AgentDetailScreen props */
export interface AgentDetailScreenProps {
  t: TFunction
  item: AgentDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  /** 开始对话回调(平台注入导航跳转 AgentChat) */
  onStartChat?: (agentId: string, name: string) => void
  colorScheme?: 'light' | 'dark'
}

/** 问答回答 */
export interface AskAnswerItem {
  id: string
  author: string
  content: string
  isAccepted: boolean
  createdAt: string
}

/** 问答详情(平台注入,字段对齐 mobile-rn AskDetailScreen Ask) */
export interface AskDetailItem {
  id: string
  title: string
  content: string
  author: string
  answers: AskAnswerItem[]
  views: number
  createdAt: string
}

/** AskDetailScreen props */
export interface AskDetailScreenProps {
  t: TFunction
  item: AskDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 问答列表项(平台注入,字段对齐 mobile-rn AskListScreen Ask) */
export interface AskListItem {
  id: string
  title: string
  author: string
  answerCount: number
  views: number
  createdAt: string
}

/** AskListScreen props */
export interface AskListScreenProps {
  t: TFunction
  items: AskListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onCreate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 证书列表项(平台注入,字段对齐 mobile-rn CertListScreen Item) */
export interface CertListItem {
  id: string
  name: string
  issuer: string
  issuedAt: string
  score: number
}

/** CertListScreen props */
export interface CertListScreenProps {
  t: TFunction
  items: CertListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 证书验证结果 */
export interface CertVerifyResult {
  valid: boolean
  certNo: string
  title: string
  holder: string
  issuer: string
  issuedAt: string
}

/** CertVerifyScreen props */
export interface CertVerifyScreenProps {
  t: TFunction
  initialCertNo: string
  result: CertVerifyResult | null
  loading: boolean
  error: string
  onVerify: (certNo: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** WithdrawScreen props(表单屏,状态由 wrapper 管理,共享层只负责渲染) */
export interface WithdrawScreenProps {
  t: TFunction
  amount: string
  bankCardId: string
  loading: boolean
  error: string
  success: string
  onAmountChange: (text: string) => void
  onBankCardIdChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 对比行(平台注入,字段对齐 mobile-rn VipCompareScreen CompareRow) */
export interface VipCompareRow {
  feature: string
  basic: string
  premium: string
  enterprise: string
}

/** VipCompareScreen props */
export interface VipCompareScreenProps {
  t: TFunction
  rows: VipCompareRow[]
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 分享生成结果(平台注入,字段对齐 mobile-rn ShareScreen ShareResp) */
export interface ShareResultItem {
  shareUrl: string
  shareCode: string
  expireAt: string
}

/** ShareScreen props */
export interface ShareScreenProps {
  t: TFunction
  targetTitle: string
  remark: string
  result: ShareResultItem | null
  loading: boolean
  error: string
  onRemarkChange: (text: string) => void
  onCreate: () => void
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 10(2026-07-29):订单日志/订单跟踪/课程章节/学习进度 */

/** 订单日志项(平台注入,字段对齐 mobile-rn OrderLogScreen Item) */
export interface OrderLogItem {
  id: string
  action: string
  operator: string
  time: string
  note: string
}

/** OrderLogScreen props */
export interface OrderLogScreenProps {
  t: TFunction
  items: OrderLogItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 订单跟踪项(平台注入,字段对齐 mobile-rn OrderTrackScreen Item) */
export interface OrderTrackItem {
  id: string
  status: string
  time: string
  location: string
  desc: string
}

/** OrderTrackScreen props */
export interface OrderTrackScreenProps {
  t: TFunction
  items: OrderTrackItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程章节项(平台注入,字段对齐 mobile-rn CourseChapterScreen Chapter) */
export interface CourseChapterItem {
  id: string
  title: string
  duration: number
  lessonCount: number
}

/** CourseChapterScreen props */
export interface CourseChapterScreenProps {
  t: TFunction
  items: CourseChapterItem[]
  loading: boolean
  error: string
  onPressItem: (item: CourseChapterItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 学习进度课程项 */
export interface StudyProgressCourse {
  id: string
  title: string
  progress: number
}

/** 学习进度数据(平台注入,字段对齐 mobile-rn StudyProgressScreen Progress) */
export interface StudyProgressData {
  totalCourses: number
  completedCourses: number
  totalMinutes: number
  weekMinutes: number
  streakDays: number
  courses: StudyProgressCourse[]
}

/** StudyProgressScreen props */
export interface StudyProgressScreenProps {
  t: TFunction
  progress: StudyProgressData | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 11(2026-07-29):表单型(问答创建/笔记创建/证书申请/账号设置) */

/** AskCreateScreen props(表单屏,状态由 wrapper 管理) */
export interface AskCreateScreenProps {
  t: TFunction
  title: string
  content: string
  tags: string
  saving: boolean
  error: string
  onTitleChange: (text: string) => void
  onContentChange: (text: string) => void
  onTagsChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** NoteCreateScreen props(表单屏,状态由 wrapper 管理) */
export interface NoteCreateScreenProps {
  t: TFunction
  title: string
  content: string
  tags: string
  isPublic: boolean
  saving: boolean
  error: string
  onTitleChange: (text: string) => void
  onContentChange: (text: string) => void
  onTagsChange: (text: string) => void
  onTogglePublic: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** CertApplyScreen props(表单屏,状态由 wrapper 管理) */
export interface CertApplyScreenProps {
  t: TFunction
  name: string
  idCard: string
  submitting: boolean
  error: string
  success: boolean
  onNameChange: (text: string) => void
  onIdCardChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 账号信息(平台注入,字段对齐 mobile-rn SettingsAccountScreen Account) */
export interface SettingsAccountItem {
  name: string
  email: string
  phone: string
}

/** SettingsAccountScreen props(表单屏,状态由 wrapper 管理) */
export interface SettingsAccountScreenProps {
  t: TFunction
  account: SettingsAccountItem | null
  loading: boolean
  saving: boolean
  error: string
  toast: string
  onNameChange: (text: string) => void
  onEmailChange: (text: string) => void
  onPhoneChange: (text: string) => void
  onSave: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 12(2026-07-29):直播列表/优惠券/关注/排行榜/积分商城/考试/VIP */

/** 直播状态 */
export type LiveStatus = 'upcoming' | 'ongoing' | 'ended' | string

/** 直播列表项(平台注入,字段对齐 mobile-rn LiveListScreen LiveItem) */
export interface LiveListItem {
  id: string
  title: string
  lecturer: string
  status: LiveStatus
  startAt: string
  viewerCount: number
  cover: string | null
}

/** 直播列表 tab key */
export type LiveListTab = 'all' | 'upcoming' | 'ongoing' | 'ended' | string

/** LiveListScreen props */
export interface LiveListScreenProps {
  t: TFunction
  items: LiveListItem[]
  activeTab: LiveListTab
  onSelectTab: (tab: LiveListTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: LiveListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 优惠券状态 */
export type CouponStatus = 'available' | 'used' | 'expired' | string

/** 优惠券列表项(平台注入,字段对齐 mobile-rn CouponScreen CouponItem) */
export interface CouponItem {
  id: string
  name: string
  amount: number
  minSpend: number
  validUntil: string
  status: CouponStatus
}

/** CouponScreen props */
export interface CouponScreenProps {
  t: TFunction
  items: CouponItem[]
  activeTab: CouponStatus
  onSelectTab: (tab: CouponStatus) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 关注用户列表项(平台注入,字段对齐 mobile-rn FollowingScreen FollowUser) */
export interface FollowingItem {
  id: string
  username: string
  nickname?: string
  avatar?: string | null
  bio?: string
  followedAt: string
}

/** FollowingScreen props */
export interface FollowingScreenProps {
  t: TFunction
  items: FollowingItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onUnfollow: (item: FollowingItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 排行榜范围 */
export type RankingRange = 'weekly' | 'monthly' | 'allTime' | string

/** 排行榜项(平台注入,字段对齐 mobile-rn RankingScreen RankItem) */
export interface RankingItem {
  id: string
  rank: number
  nickname: string
  avatar: string | null
  points: number
  studyHours: number
  isMe: boolean
}

/** RankingScreen props */
export interface RankingScreenProps {
  t: TFunction
  top3: RankingItem[]
  rest: RankingItem[]
  range: RankingRange
  onSelectRange: (range: RankingRange) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分商城商品(平台注入,字段对齐 mobile-rn PointsMallScreen Product) */
export interface PointsMallItem {
  id: string
  name: string
  description: string
  pointsCost: number
  stock: number
  cover: string | null
}

/** PointsMallScreen props */
export interface PointsMallScreenProps {
  t: TFunction
  items: PointsMallItem[]
  balance: number
  redeemingId: string | null
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onRedeem: (item: PointsMallItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 考试状态 */
export type ExamStatus = 'notStarted' | 'inProgress' | 'ended' | string

/** 考试项(平台注入,字段对齐 mobile-rn ExamScreen Exam) */
export interface ExamItem {
  id: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  duration: number
  totalScore: number
  passScore: number
  questionCount: number
  attemptCount: number
  maxAttempts: number
}

/** ExamScreen props */
export interface ExamScreenProps {
  t: TFunction
  items: ExamItem[]
  /** 计算考试状态(平台注入) */
  getStatus: (exam: ExamItem) => ExamStatus
  loading: boolean
  refreshing: boolean
  error: string
  toast: string
  onRefresh: () => void
  onStart: (exam: ExamItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 等级(平台注入,字段对齐 mobile-rn VipScreen VipLevel) */
export interface VipLevelItem2 {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  status: number
  benefits?: Record<string, unknown>
}

/** VIP 会员信息(平台注入,字段对齐 mobile-rn VipScreen MembershipInfo) */
export interface VipMembershipInfo {
  isActive: boolean
  level: number
  levelName: string
  expireTime: string
  daysRemaining: number
}

/** VipScreen props */
export interface VipScreenProps {
  t: TFunction
  levels: VipLevelItem2[]
  membership: VipMembershipInfo | null
  loading: boolean
  refreshing: boolean
  error: string
  toast: string
  purchasingId: string | null
  onRefresh: () => void
  onPurchase: (level: VipLevelItem2) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 13(2026-07-29):登录/注册/资料编辑/换绑手机 */

/** LoginScreen props(表单屏,状态由 wrapper 管理) */
export interface LoginScreenProps {
  t: TFunction
  account: string
  password: string
  loading: boolean
  ssoLoading: boolean
  error: string
  onAccountChange: (text: string) => void
  onPasswordChange: (text: string) => void
  onLogin: () => void
  onSsoLogin: () => void
  colorScheme?: 'light' | 'dark'
}

/** RegisterScreen props(表单屏) */
export interface RegisterScreenProps {
  t: TFunction
  account: string
  password: string
  confirmPassword: string
  loading: boolean
  error: string
  onAccountChange: (text: string) => void
  onPasswordChange: (text: string) => void
  onConfirmPasswordChange: (text: string) => void
  onRegister: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 性别(0=保密,1=男,2=女) */
export type Gender = 0 | 1 | 2

/** ProfileEditScreen props(表单屏,状态由 wrapper 管理) */
export interface ProfileEditScreenProps {
  t: TFunction
  nickname: string
  bio: string
  gender: Gender
  avatar: string | null
  loading: boolean
  saving: boolean
  error: string
  avatarModalVisible: boolean
  avatarInput: string
  onNicknameChange: (text: string) => void
  onBioChange: (text: string) => void
  onGenderChange: (gender: Gender) => void
  onOpenAvatarModal: () => void
  onCloseAvatarModal: () => void
  onAvatarInputChange: (text: string) => void
  onConfirmAvatar: () => void
  onSave: () => void
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 国家区号选项 */
export interface NationOption {
  id: number
  title: string
  content: string
}

/** ChangePhoneScreen props(表单屏,状态由 wrapper 管理) */
export interface ChangePhoneScreenProps {
  t: TFunction
  phoneNumber: string
  codeValue: string
  phoneHead: string
  nationShow: boolean
  codeMin: number
  sendCodeShow: boolean
  tip: string
  submitting: boolean
  nations: NationOption[]
  onPhoneChange: (text: string) => void
  onCodeChange: (text: string) => void
  onToggleNationShow: () => void
  onSelectNation: (nation: NationOption) => void
  onSendCode: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 14(2026-07-29 P3-3.3 实际迁移批次 10):Agent 市场/Agent 评价/活动/收藏/签到 */

/** Agent 市场项(平台注入,字段对齐 mobile-rn AgentMarketScreen Agent) */
export interface AgentMarketItem {
  id: string
  name: string
  description: string
  category: string
  uses: number
  rating: number
  isFree: boolean
}

/** AgentMarketScreen props */
export interface AgentMarketScreenProps {
  t: TFunction
  items: AgentMarketItem[]
  keyword: string
  loading: boolean
  error: string
  onKeywordChange: (text: string) => void
  onSearch: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agent 评价项(平台注入,字段对齐 mobile-rn AgentReviewListScreen Item) */
export interface AgentReviewListItem {
  id: string
  agentName: string
  author: string
  rating: number
  content: string
  createdAt: string
}

/** AgentReviewListScreen props */
export interface AgentReviewListScreenProps {
  t: TFunction
  items: AgentReviewListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 活动状态 */
export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended'

/** 活动项(平台注入,字段对齐 mobile-rn ActivityScreen Activity) */
export interface ActivityItem {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  status: ActivityStatus
  participants: number
}

/** ActivityScreen props */
export interface ActivityScreenProps {
  t: TFunction
  items: ActivityItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 收藏项(平台注入,字段对齐 mobile-rn FavoritesScreen FavoriteItem) */
export interface FavoritesItem {
  id: string
  title: string
  cover: string | null
  targetType: string
  createdAt: string
}

/** FavoritesScreen props */
export interface FavoritesScreenProps {
  t: TFunction
  items: FavoritesItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onDelete: (item: FavoritesItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 签到日历项(平台注入,字段对齐 mobile-rn CheckInScreen CheckInDay) */
export interface CheckInDay {
  date: string
  signed: boolean
  reward: number
}

/** 签到信息(平台注入,字段对齐 mobile-rn CheckInScreen CheckInInfo) */
export interface CheckInInfo {
  todaySigned: boolean
  streak: number
  totalDays: number
  monthlyDays: number
  todayReward: number
  calendar: CheckInDay[]
}

/** CheckInScreen props */
export interface CheckInScreenProps {
  t: TFunction
  info: CheckInInfo | null
  loading: boolean
  refreshing: boolean
  signing: boolean
  error: string
  onSign: () => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 直播列表项(平台注入,字段对齐 mobile-rn LiveScreen Live) */
export interface LiveScreenItem {
  id: string
  title: string
  lecturerName?: string
  isLive: boolean
  startTime: string
  viewCount: number
}

/** LiveScreen props(简化版直播列表,无 tab 切换) */
export interface LiveScreenProps {
  t: TFunction
  items: LiveScreenItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 15(2026-07-29):消息/记录/关系类(私聊/群聊/系统/详情/积分/学习/收益/邀请/关注/收藏) */

/** 私信列表项(对齐 mobile-rn MessageDirectScreen Item) */
export interface MessageDirectItem {
  memberId: string
  nickname: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}
export interface MessageDirectScreenProps {
  t: TFunction
  items: MessageDirectItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageDirectItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 群聊列表项(对齐 mobile-rn MessageGroupScreen Item) */
export interface MessageGroupItem {
  groupId: string
  groupName: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}
export interface MessageGroupScreenProps {
  t: TFunction
  items: MessageGroupItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageGroupItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 系统消息列表项(对齐 mobile-rn MessageSystemScreen Item) */
export interface MessageSystemItem {
  id: string
  title: string
  content: string
  time: string
  read: boolean
}
export interface MessageSystemScreenProps {
  t: TFunction
  items: MessageSystemItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageSystemItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 消息详情(对齐 mobile-rn MessageDetailScreen Message) */
export interface MessageDetailData {
  id: string
  subject: string
  content: string
  fromUser: string
  createdAt: string
  read: boolean
}
export interface MessageDetailScreenProps {
  t: TFunction
  message: MessageDetailData | null
  loading: boolean
  error: string
  onReply: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分记录项(对齐 mobile-rn PointsRecordScreen PointsRecord) */
export type PointsRecordType = 'all' | 'earn' | 'spend'
export interface PointsRecordItem {
  id: string
  type: 'earn' | 'spend'
  source: string
  amount: number
  balanceAfter: number
  createdAt: string
}
export interface PointsRecordScreenProps {
  t: TFunction
  items: PointsRecordItem[]
  balance: number
  activeTab: PointsRecordType
  onSelectTab: (tab: PointsRecordType) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 学习记录统计(对齐 mobile-rn StudyRecordScreen StudyStats) */
export interface StudyRecordStats {
  totalDuration: number
  totalCourses: number
  completedCourses: number
  totalLessons: number
  completedLessons: number
  continuousDays: number
}
export type StudyRecordStatus = 'in_progress' | 'paused' | 'completed'
export interface StudyRecordItem {
  id: string
  courseTitle: string | null
  lessonTitle: string | null
  status: StudyRecordStatus
  duration?: number
  progress?: number
  lastStudyAt: string
}
export interface StudyRecordScreenProps {
  t: TFunction
  records: StudyRecordItem[]
  stats: StudyRecordStats | null
  userNickname: string
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 收益记录项(对齐 mobile-rn IncomeScreen CommissionItem) */
export interface IncomeCommissionItem {
  id: string
  title: string
  amount: number
  time: string
  settled: boolean
}
export interface IncomeData {
  totalEarnings: number
  todayCommission: number
  balance: number
  list: IncomeCommissionItem[]
}
export interface IncomeScreenProps {
  t: TFunction
  data: IncomeData
  loading: boolean
  error: string
  onWithdraw: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 邀请信息(对齐 mobile-rn InviteScreen InviteInfo) */
export interface InviteInfo {
  inviteCode: string
  inviteUrl: string
  totalInvited: number
  totalReward: number
}
export interface InviteRecordItem {
  id: string
  nickname: string
  invitedAt: string
  reward: number
  status: 'pending' | 'completed'
}
export interface InviteScreenProps {
  t: TFunction
  info: InviteInfo | null
  records: InviteRecordItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 关注/粉丝项(对齐 mobile-rn FollowScreen FollowUser) */
export type FollowTab = 'following' | 'fans'
export interface FollowUserItem {
  id: string
  nickname: string | null
  username: string
  avatar: string | null
  bio: string | null
  followedAt: string
}
export interface FollowScreenProps {
  t: TFunction
  items: FollowUserItem[]
  activeTab: FollowTab
  onSelectTab: (tab: FollowTab) => void
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onUnfollow: (item: FollowUserItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 收藏项(对齐 mobile-rn FavoriteScreen FavoriteItem) */
export type FavoriteFilterTab = 'all' | 'course' | 'live' | 'article'
export interface FavoriteItemRow {
  id: string
  targetType: string
  targetId: string
  title: string
  cover: string | null
  createdAt: string
}
export interface FavoriteScreenProps {
  t: TFunction
  items: FavoriteItemRow[]
  activeTab: FavoriteFilterTab
  onSelectTab: (tab: FavoriteFilterTab) => void
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onDelete: (item: FavoriteItemRow) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 18(2026-07-29):模型/AIGC 屏(模型广场/n8n 模型管理/模型编辑/AIGC 作品列表) */

/** 模型类型(对齐 mobile-rn ModelPlazaScreen ModelType) */
export type ModelPlazaModelType = 'text' | 'image' | 'av'
export type ModelPlazaTypeFilter = 'all' | ModelPlazaModelType

/** 模型广场供应商(对齐 mobile-rn ModelPlazaScreen Provider) */
export interface ModelPlazaProvider {
  id: string
  name: string
  total: number
  desc: string
}

/** 模型广场列表项(对齐 mobile-rn ModelPlazaScreen Model) */
export interface ModelPlazaItem {
  id: string
  providerId: string
  name: string
  type: ModelPlazaModelType
  inputPrice: number | null
  outputPrice: number | null
  desc: string
  tags: string[]
  payMode: string
}

/** ModelPlazaScreen props — 注入式(状态由 wrapper 管理,纯 UI 渲染) */
export interface ModelPlazaScreenProps {
  t: TFunction
  items: ModelPlazaItem[]
  providers: ModelPlazaProvider[]
  providerId: string
  typeFilter: ModelPlazaTypeFilter
  loading: boolean
  refreshing: boolean
  error: string
  onSelectProvider: (id: string) => void
  onSelectType: (filter: ModelPlazaTypeFilter) => void
  onRefresh: () => void
  onPressCompare: () => void
  onPressItem: (item: ModelPlazaItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** n8n 工作流状态(对齐 mobile-rn N8nModelScreen Status) */
export type N8nModelStatus = 'running' | 'stopped'
export type N8nModelTab = 'all' | 'running' | 'stopped'

/** n8n 模型列表项(对齐 mobile-rn N8nModelScreen N8nModel) */
export interface N8nModelItem {
  id: string
  name: string
  desc: string
  url: string
  status: N8nModelStatus
  calls: number
  updatedAt: string
  paramsIn: number
  paramsOut: number
}

/** N8nModelScreen props — 注入式 */
export interface N8nModelScreenProps {
  t: TFunction
  items: N8nModelItem[]
  tab: N8nModelTab
  keyword: string
  loading: boolean
  refreshing: boolean
  error: string
  onSelectTab: (tab: N8nModelTab) => void
  onKeywordChange: (kw: string) => void
  onRefresh: () => void
  onRetry: () => void
  onToggle: (item: N8nModelItem) => void
  onEdit: (item: N8nModelItem) => void
  onCreate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 模型编辑售卖方式(对齐 mobile-rn ModelEditScreen SaleType) */
export type ModelEditSaleType = 'free' | 'limited' | 'paid'
/** 模型编辑收费周期(对齐 mobile-rn ModelEditScreen PayCycle) */
export type ModelEditPayCycle = 'month' | 'year' | 'permanent'
/** 模型编辑面向群体(对齐 mobile-rn ModelEditScreen Audience) */
export type ModelEditAudience = 'all' | 'member'

/** 模型编辑选项(类别/部门/折扣等通用 chip 选项) */
export interface ModelEditOption {
  id: string
  label: string
}

/** 模型编辑基础信息(头像+名称+开场白) */
export interface ModelEditBaseInfo {
  name: string
  prologue: string
}

/** 模型编辑表单字段值(由 wrapper 持有,onChange 回写) */
export interface ModelEditFieldValues {
  categories: string[]
  dept: string
  saleType: ModelEditSaleType
  cycle: ModelEditPayCycle
  price: string
  freeDur: string
  audience: ModelEditAudience
  discount: string
}

/** ModelEditScreen props — 表单型注入式 */
export interface ModelEditScreenProps {
  t: TFunction
  baseInfo: ModelEditBaseInfo
  fields: ModelEditFieldValues
  categoryOptions: ModelEditOption[]
  deptOptions: ModelEditOption[]
  freeDurations: string[]
  discountOptions: ModelEditOption[]
  submitting: boolean
  onChange: <K extends keyof ModelEditFieldValues>(key: K, value: ModelEditFieldValues[K]) => void
  onToggleCategory: (id: string) => void
  onSave: () => void
  onCancel: () => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 作品文件类型(对齐 mobile-rn AigcListScreen FileType:0=图片/1=视频/3=音频/4=文案) */
export type AigcFileType = 0 | 1 | 3 | 4
export type AigcCategory = 'all' | 'image' | 'video' | 'audio' | 'text'

/** AIGC 作品列表项(对齐 mobile-rn AigcListScreen AigcWork) */
export interface AigcListItem {
  id: string
  title: string
  subtitle?: string
  prompt?: string
  content?: string
  fileUrl?: string
  coverUrl?: string
  audioUrl?: string
  duration?: string
  fileType: AigcFileType
  createdAt: string
}

/** AIGC 分类选项(对齐 mobile-rn AigcListScreen CATEGORIES) */
export interface AigcCategoryOption {
  key: AigcCategory
  label: string
  fileType?: AigcFileType
}

/** AigcListScreen props — 注入式 */
export interface AigcListScreenProps {
  t: TFunction
  items: AigcListItem[]
  categories: AigcCategoryOption[]
  category: AigcCategory
  loading: boolean
  refreshing: boolean
  error: string
  onSelectCategory: (c: AigcCategory) => void
  onRefresh: () => void
  onPressItem: (item: AigcListItem) => void
  onPublish: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 16(2026-07-29):考试历史/考试结果/模型收益/Token 价值 */

/** 考试历史列表项(平台注入,字段对齐 mobile-rn ExamHistoryScreen ExamHistory) */
export interface ExamHistoryItem {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  /** 提交时间(ISO 或格式化字符串) */
  submittedAt: string
}

/** ExamHistoryScreen props */
export interface ExamHistoryScreenProps {
  t: TFunction
  items: ExamHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击历史记录回调,平台注入导航跳转(如 navigate('ExamResult', { id })) */
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 考试错题项(平台注入,字段对齐 mobile-rn ExamResultScreen wrongQuestions) */
export interface ExamResultWrongQuestion {
  /** 题目序号(0-based) */
  index: number
  question: string
  yourAnswer: string
  correctAnswer: string
}

/** 考试结果详情(平台注入,字段对齐 mobile-rn ExamResultScreen ExamResult) */
export interface ExamResultItem {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  correctCount: number
  totalCount: number
  /** 答题时长(分钟) */
  duration: number
  submittedAt: string
  wrongQuestions: ExamResultWrongQuestion[]
}

/** ExamResultScreen props */
export interface ExamResultScreenProps {
  t: TFunction
  item: ExamResultItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 模型收益 Tab key(全部/待结算/已结算) */
export type ModelIncomeTab = 'all' | 'pending' | 'settled' | string

/** 模型收益列表项(平台注入,字段对齐 mobile-rn ModelIncomeScreen CommissionRecord) */
export interface ModelIncomeItem {
  id: string
  orderId: string
  /** 结算状态(原始 status 字段,'settled'/'2' 视为已结算) */
  status: string
  createdAt: string
  userNickname: string
  orderAmount: number
  /** 佣金费率(百分比) */
  rate: number
  commissionAmount: number
}

/** 模型收益概要(平台注入,字段对齐 @ihui/api-client CommissionOverview + DayMonthSummary) */
export interface ModelIncomeSummary {
  /** 累计收益 */
  totalCommission: number
  /** 可提现 */
  availableCommission: number
  /** 已提现 */
  withdrawnCommission: number
  /** 待结算 */
  pendingCommission: number
  /** 今日收益 */
  day: number
}

/** ModelIncomeScreen props */
export interface ModelIncomeScreenProps {
  t: TFunction
  items: ModelIncomeItem[]
  summary: ModelIncomeSummary | null
  loading: boolean
  refreshing: boolean
  error: string
  activeTab: ModelIncomeTab
  onSelectTab: (tab: ModelIncomeTab) => void
  onRefresh: () => void
  /** 提现弹窗可见性(wrapper 控制) */
  showWithdrawModal: boolean
  onOpenWithdraw: () => void
  onCloseWithdraw: () => void
  onConfirmWithdraw: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Token 记录 Tab key(全部/消耗/充值) */
export type TokenRecordType = 'all' | 'cost' | 'recharge' | string

/** Token 余额(平台注入,字段对齐 @ihui/api-client TokenBalance,补充 frozen 占位) */
export interface TokenValueBalance {
  /** 可用算力 */
  balance: number
  /** 冻结(TokenBalance API 不返回,占位 0) */
  frozen: number
  /** 累计消耗 */
  totalUsed: number
}

/** Token 流水记录项(平台注入,合并消耗 + 充值,字段对齐 mobile-rn TokenValueScreen Record) */
export interface TokenValueRecord {
  id: string
  type: 'cost' | 'recharge'
  title: string
  /** 金额(消耗为负,充值为正) */
  amount: number
  /** 已格式化的时间文本 */
  time: string
}

/** Token 充值套餐(产品配置,静态前端数据,字段对齐 mobile-rn TokenValueScreen Package) */
export interface TokenValuePackage {
  id: string
  tokens: number
  price: number
  bonus: number
  popular?: boolean
}

/** TokenValueScreen props */
export interface TokenValueScreenProps {
  t: TFunction
  balance: TokenValueBalance | null
  records: TokenValueRecord[]
  loading: boolean
  refreshing: boolean
  error: string
  activeTab: TokenRecordType
  onSelectTab: (tab: TokenRecordType) => void
  onRefresh: () => void
  /** 点击充值套餐回调,平台注入支付确认(Alert/弹窗/导航) */
  onRecharge: (pkg: TokenValuePackage) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 17(2026-07-29):直播详情/主播端/预告/回放(单条直播深 4 屏) */

/** LiveDetail 聊天连接状态(对齐 mobile-rn LiveChatClient ChatStatus) */
export type LiveDetailChatStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error' | 'closed'

/** LiveDetail 聊天消息(对齐 mobile-rn LiveChatClient ChatMessage) */
export interface LiveDetailChatMessage {
  id: string
  nickname: string
  content: string
  /** 已格式化的时间文本(平台注入,避免共享层依赖日期工具) */
  createdAt: string
}

/** LiveDetail 直播详情(平台注入,字段对齐 @ihui/api-client Live 子集) */
export interface LiveDetailItem {
  id: string
  title: string
  isLive: boolean
  lecturerName?: string
  viewCount: number
  playUrl?: string | null
  intro?: string | null
}

/** LiveDetailScreen props(注入式:wrapper 保留 WebSocket/API 调用) */
export interface LiveDetailScreenProps {
  t: TFunction
  live: LiveDetailItem | null
  loading: boolean
  error: string
  subscribed: boolean
  subscribing: boolean
  messages: LiveDetailChatMessage[]
  input: string
  chatStatus: LiveDetailChatStatus
  chatError: string
  onInputChange: (text: string) => void
  onSend: () => void
  onSubscribe: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LiveHost 推流状态(对齐 mobile-rn LiveHostScreen StreamStatus) */
export type LiveHostStatus = 'idle' | 'active' | 'inactive'

/** LiveHost 推流数据(平台注入,字段对齐 SRS API StreamData) */
export interface LiveHostStreamData {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  recvBytes: number | null
  sendBytes: number | null
}

/** LiveHost 商品(平台注入,字段对齐 mobile-rn LiveHostScreen Product) */
export interface LiveHostProduct {
  id: string
  name: string
  price: number
}

/** LiveHostScreen props(注入式:wrapper 保留推流/SRS API 调用) */
export interface LiveHostScreenProps {
  t: TFunction
  status: LiveHostStatus
  streamTitle: string
  onStreamTitleChange: (text: string) => void
  stream: LiveHostStreamData | null
  /** 观众数(平台注入,共享层不维护定时器) */
  viewers: number
  /** 已格式化的时长文本(平台注入) */
  durationText: string
  /** 已格式化的字节文本(平台注入,recvBytes) */
  recvBytesText: string
  /** 已格式化的字节文本(平台注入,sendBytes) */
  sendBytesText: string
  loading: boolean
  error: string
  products: LiveHostProduct[]
  productsLoading: boolean
  productsError: string
  onStartLive: () => void
  onEndLive: () => void
  onAddProduct: () => void
  onCopyText: (text: string, label: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LivePreview 预告详情(平台注入,字段对齐 mobile-rn LivePreviewScreen Detail) */
export interface LivePreviewItem {
  id: string
  title: string
  lecturer: string
  startAt: string
  intro: string
  subscribed: boolean
}

/** LivePreviewScreen props */
export interface LivePreviewScreenProps {
  t: TFunction
  item: LivePreviewItem | null
  loading: boolean
  error: string
  subscribing: boolean
  onSubscribe: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LivePlayback 列表项(平台注入,字段对齐 @ihui/api-client Live 子集) */
export interface LivePlaybackScreenItem {
  id: string
  title: string
  lecturerName?: string
  /** 已格式化的开始时间文本(平台注入) */
  startTimeText: string
  /** 已格式化的时长文本(平台注入) */
  durationText: string
  viewCount: number
  playUrl?: string | null
}

/** LivePlaybackScreen props */
export interface LivePlaybackScreenProps {
  t: TFunction
  items: LivePlaybackScreenItem[]
  loading: boolean
  refreshing: boolean
  error: string
  /** 当前播放的回放(平台注入,控制 Modal 显隐) */
  activeItem: LivePlaybackScreenItem | null
  /** 用户昵称(平台注入,header 展示) */
  userName: string
  onRefresh: () => void
  onPressItem: (item: LivePlaybackScreenItem) => void
  onClosePlayer: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 20(2026-07-29):AI/聊天屏(助手管理/AI 群组/AIGC 封面/AIGC 发布,4 屏迁移自 mobile-rn) */

/** 助手状态 */
export type AssistantStatus = 'draft' | 'reviewing' | 'published' | 'rejected' | 'offline'

/** 助手主标签页 */
export type AssistantTab = 'draft' | 'reviewing' | 'published'

/** 助子子标签页(draft 下细分) */
export type AssistantSubTab = 'all' | 'rejected' | 'offline'

/** 助手项 */
export interface AssistantItem {
  id: string
  name: string
  prologue: string
  status: AssistantStatus
  /** 已格式化的类别文本(平台注入) */
  category?: string
  /** 售卖价格(分) */
  price?: number
  /** 售卖周期文本(平台注入,如 "月"/"年",为空表示永久) */
  cycle?: string
  /** 已格式化的受众文本(平台注入,如 "会员"/"全部用户") */
  audience?: string
  /** 已格式化的上架时间文本(平台注入) */
  publishTime?: string
}

/** AssistantScreen props */
export interface AssistantScreenProps {
  t: TFunction
  items: AssistantItem[]
  tab: AssistantTab
  subTab: AssistantSubTab
  keyword: string
  loading: boolean
  refreshing: boolean
  error: string
  onTabChange: (tab: AssistantTab) => void
  onSubTabChange: (subTab: AssistantSubTab) => void
  onKeywordChange: (keyword: string) => void
  onRefresh: () => void
  onEdit: (item: AssistantItem) => void
  onOffline: (item: AssistantItem) => void
  colorScheme?: 'light' | 'dark'
}

/** AI 群组标签页 */
export type AiGroupTab = 'mine' | 'discover'

/** AI 群组成员 */
export interface AiGroupMember {
  id: string
  name: string
  role: string
}

/** AI 群组项 */
export interface AiGroupItem {
  id: string
  name: string
  desc: string
  tag: string
  members: AiGroupMember[]
  messages: number
  /** 已格式化的最近活跃时间文本(平台注入) */
  lastActive: string
}

/** AiGroupScreen props */
export interface AiGroupScreenProps {
  t: TFunction
  items: AiGroupItem[]
  tab: AiGroupTab
  /** 当前选中的群组(平台注入,控制详情视图显隐) */
  selectedItem: AiGroupItem | null
  loading: boolean
  refreshing: boolean
  error: string
  onTabChange: (tab: AiGroupTab) => void
  onPressItem: (item: AiGroupItem) => void
  onBackToList: () => void
  onEnterChat: (item: AiGroupItem) => void
  onRefresh: () => void
  onRetry: () => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 封面过滤器 */
export type AigcCoverFilter = 'all' | 'work' | 'ai'

/** AIGC 封面选项 */
export interface AigcCoverOption {
  id: string
  url: string
  label: string
  source: 'work' | 'ai'
}

/** AigcCoverScreen props */
export interface AigcCoverScreenProps {
  t: TFunction
  workTitle: string
  covers: AigcCoverOption[]
  selectedId: string | null
  filter: AigcCoverFilter
  loading: boolean
  error: string
  onSelectCover: (id: string) => void
  onFilterChange: (filter: AigcCoverFilter) => void
  onConfirm: (cover: AigcCoverOption) => void
  onGenerateAi: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 发布作品类型 */
export type AigcPublishWorkType = 'image' | 'video' | 'audio' | 'text'

/** AIGC 发布素材文件 */
export interface AigcPublishFile {
  id: string
  url: string
}

/** AigcPublishScreen props */
export interface AigcPublishScreenProps {
  t: TFunction
  workType: AigcPublishWorkType
  files: AigcPublishFile[]
  textContent: string
  title: string
  description: string
  prompt: string
  urlInput: string
  saving: boolean
  uploading: boolean
  error: string
  onWorkTypeChange: (type: AigcPublishWorkType) => void
  onTextContentChange: (text: string) => void
  onTitleChange: (title: string) => void
  onDescriptionChange: (desc: string) => void
  onPromptChange: (prompt: string) => void
  onUrlInputChange: (url: string) => void
  onAddFileByUrl: () => void
  onPickImage: () => void
  onRemoveFile: (id: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
