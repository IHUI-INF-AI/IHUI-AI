// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「profile」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { SharedAppInfo, SharedLocaleOption, SharedMenuItem, SharedMenuSection, SharedNotificationToggles, SharedThemeOption, SharedUser, SharedUserStatistics, TFunction } from './app-shared.js'
import type { Gender } from './app-account.js'


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

/** 通知设置数据 */
export interface NotificationSettingsItem {
  pushEnabled: boolean
  messageEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  marketingEnabled: boolean
}

/** NotificationSettingsScreen props */
export interface NotificationSettingsScreenProps {
  t: TFunction
  settings: NotificationSettingsItem | null
  loading: boolean
  saving: boolean
  error: string
  success: string
  onToggle: (key: keyof NotificationSettingsItem, value: boolean) => void
  onSave: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 客服信息(CustomerServiceScreen) */
export interface CustomerServiceInfo {
  online: boolean
  phone: string
  email: string
  workingHours: string
  working: boolean
}

/** CustomerServiceScreen props */
export interface CustomerServiceScreenProps {
  t: TFunction
  info: CustomerServiceInfo | null
  loading: boolean
  error: string
  onCall: () => void
  onEmail: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface UsageRulesScreenProps {
  t: TFunction
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
