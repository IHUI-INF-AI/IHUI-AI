// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「engagement」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { TFunction } from './app-shared.js'


/** 反馈类型(与后端 /api/feedbacks 契约对齐) */
export type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other'

/** Feedback 屏提交载荷 */
export interface FeedbackSubmitPayload {
  type: FeedbackType
  content: string
  contact: string
  /** 问题截图 URL 数组(对齐 Uniapp fankui filePaths,最多 9 张,逗号分隔存 filePath 字段) */
  images?: string[]
}

/** Feedback 屏 props */
export interface FeedbackScreenProps {
  t: TFunction
  /** 提交回调,返回 true 表示成功(平台注入实际 API 调用) */
  onSubmit: (payload: FeedbackSubmitPayload) => Promise<boolean>
  onBack: () => void
  /** 选图回调(平台注入 expo-image-picker;返回已选图片 URL 数组,最多 9 张;不传则隐藏上传区) */
  onPickImages?: () => Promise<string[]>
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

/** 浏览历史对象类型(与后端 /api/browse-history 契约对齐) */
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

/** 订阅项(SubscriptionsScreen) */
export interface SubscriptionsItem {
  id: string
  targetType: string
  targetId: string
  createdAt: string
}

/** SubscriptionsScreen props */
export interface SubscriptionsScreenProps {
  t: TFunction
  items: SubscriptionsItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onCancel: (item: SubscriptionsItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
