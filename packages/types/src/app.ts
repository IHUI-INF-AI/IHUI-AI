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
