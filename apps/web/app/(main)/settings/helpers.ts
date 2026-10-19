// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentType } from 'react'
import {
  LayoutDashboard,
  User,
  Receipt,
  Link2,
  Key,
  Settings,
  Activity,
  UserX,
  Shield,
  Download,
  FileText,
  Bell,
  PackagePlus,
  LogIn,
  Network,
  KeyRound,
  Bot,
  Lock,
  ShieldCheck,
} from 'lucide-react'

export const SIDEBAR_KEY = 'sidebar-collapsed'

/* ========== 侧边栏分组导航(CategoryShell 用) ========== */

export interface SettingsNavItem {
  href: string
  labelKey: string
  icon: ComponentType<{ className?: string }>
}

export interface SettingsNavGroup {
  labelKey?: string
  items: SettingsNavItem[]
}

/**
 * 导航 labelKey 全键表(2026-10-19 立)
 *
 * 为什么需要这张表:navGroups 由 layout.tsx 用 `t(group.labelKey)` / `t(item.labelKey)`
 * 取词(labelKey 是变量,不是字面量),而守门 121(`check-declared-policy-has-consumer.mjs`
 * C6 档)判 i18n 键"是否接线"时**只认静态发射点**:`t('字面量')`,或全键字面量表 + `t(表[表达式])`。
 * 纯 `t(变量)` 两型都判不出 ⇒ 新增导航键会被记成"未接线"并顶破棘轮
 * (实测:`en.json` 未接线 5596 > 锚点 5595,正是新增 `dataRightsTitle` 那一刻)。
 *
 * 本表把全键写成字面量,与 NAV_GROUPS 的 labelKey 一一对应;键增删时两处同批改。
 */
export const SETTINGS_NAV_LABEL_KEY: Record<string, string> = {
  navOverview: 'settings.navOverview',
  navAccount: 'settings.navAccount',
  navSecurity: 'settings.navSecurity',
  navPreferences: 'settings.navPreferences',
  navDeveloper: 'settings.navDeveloper',
  navBilling: 'settings.navBilling',
  title: 'settings.title',
  connectedAccountsTitle: 'settings.connectedAccountsTitle',
  loginSecurityTitle: 'settings.loginSecurityTitle',
  accountDeletionTitle: 'settings.accountDeletionTitle',
  authorizationsTitle: 'settings.authorizationsTitle',
  securityLogTitle: 'settings.securityLogTitle',
  privacyTitle: 'settings.privacyTitle',
  agentSecurityTitle: 'settings.agentSecurityTitle',
  notificationsTitle: 'settings.notificationsTitle',
  activityTitle: 'settings.activityTitle',
  preferencesTitle: 'settings.preferencesTitle',
  apiKeysNavTitle: 'settings.apiKeysNavTitle',
  llmConfigsTitle: 'settings.llmConfigsTitle',
  'gateway.navLabel': 'settings.gateway.navLabel',
  modelRecordTitle: 'settings.modelRecordTitle',
  cliImportTitle: 'settings.cliImportTitle',
  icpRecordTitle: 'settings.icpRecordTitle',
  billingTitle: 'settings.billingTitle',
  dataExportTitle: 'settings.dataExportTitle',
  dataRightsTitle: 'settings.dataRightsTitle',
  dashboardTitle: 'settings.dashboardTitle',
}

export const NAV_GROUPS: readonly SettingsNavGroup[] = [
  {
    labelKey: 'navOverview',
    items: [{ href: '/settings', labelKey: 'title', icon: Settings }],
  },
  {
    labelKey: 'navAccount',
    items: [
      { href: '/settings/connected-accounts', labelKey: 'connectedAccountsTitle', icon: Link2 },
      { href: '/settings/login-security', labelKey: 'loginSecurityTitle', icon: LogIn },
      { href: '/settings/account-deletion', labelKey: 'accountDeletionTitle', icon: UserX },
    ],
  },
  {
    labelKey: 'navSecurity',
    items: [
      { href: '/settings/authorizations', labelKey: 'authorizationsTitle', icon: Lock },
      { href: '/settings/security-log', labelKey: 'securityLogTitle', icon: FileText },
      { href: '/settings/privacy', labelKey: 'privacyTitle', icon: Shield },
      { href: '/settings/agent-security', labelKey: 'agentSecurityTitle', icon: ShieldCheck },
    ],
  },
  {
    labelKey: 'navPreferences',
    items: [
      { href: '/settings/notifications', labelKey: 'notificationsTitle', icon: Bell },
      { href: '/settings/activity', labelKey: 'activityTitle', icon: Activity },
      { href: '/settings/preferences', labelKey: 'preferencesTitle', icon: Settings },
    ],
  },
  {
    labelKey: 'navDeveloper',
    items: [
      { href: '/settings/api-keys', labelKey: 'apiKeysNavTitle', icon: KeyRound },
      { href: '/settings/llm', labelKey: 'llmConfigsTitle', icon: Bot },
      { href: '/settings/gateway', labelKey: 'gateway.navLabel', icon: Network },
      { href: '/settings/model-record', labelKey: 'modelRecordTitle', icon: Bot },
      { href: '/settings/import', labelKey: 'cliImportTitle', icon: PackagePlus },
      { href: '/settings/icp-record', labelKey: 'icpRecordTitle', icon: FileText },
    ],
  },
  {
    labelKey: 'navBilling',
    items: [
      { href: '/settings/billing', labelKey: 'billingTitle', icon: Receipt },
      { href: '/settings/data-export', labelKey: 'dataExportTitle', icon: Download },
      // 2026-10-19 P1 侧边栏归位:该页原先唯一入口是主侧边栏 nav-data 的 /settings/data-rights,
      // 收侧边栏时同步在此补位,否则删完即成零入口孤儿页(只能手敲 URL,与 nav-data.ts:511
      // 记录的"错题本/今日复习全站无入口"同型)。与 data-export 同组(GDPR 数据权利族)。
      { href: '/settings/data-rights', labelKey: 'dataRightsTitle', icon: Download },
      { href: '/settings/dashboard', labelKey: 'dashboardTitle', icon: LayoutDashboard },
    ],
  },
]

export const SUB_PAGES = [
  {
    href: '/settings/dashboard',
    icon: LayoutDashboard,
    titleKey: 'dashboardTitle',
    descKey: 'dashboardDesc',
  },
  { href: '/user/profile', icon: User, titleKey: 'profileTitle', descKey: 'profileDesc' },
  { href: '/settings/billing', icon: Receipt, titleKey: 'billingTitle', descKey: 'billingDesc' },
  {
    href: '/settings/connected-accounts',
    icon: Link2,
    titleKey: 'connectedAccountsTitle',
    descKey: 'connectedAccountsDesc',
  },
  { href: '/settings/llm', icon: Key, titleKey: 'llmConfigsTitle', descKey: 'llmConfigsDesc' },
  {
    href: '/settings/gateway',
    icon: Network,
    titleKey: 'gateway.navLabel',
    descKey: 'gateway.subtitle',
  },
  {
    href: '/settings/import',
    icon: PackagePlus,
    titleKey: 'cliImportTitle',
    descKey: 'cliImportDesc',
  },
  {
    href: '/settings/preferences',
    icon: Settings,
    titleKey: 'preferencesTitle',
    descKey: 'preferencesDesc',
  },
  {
    href: '/settings/activity',
    icon: Activity,
    titleKey: 'activityTitle',
    descKey: 'activityDesc',
  },
  {
    href: '/settings/account-deletion',
    icon: UserX,
    titleKey: 'accountDeletionTitle',
    descKey: 'accountDeletionDesc',
  },
  { href: '/settings/privacy', icon: Shield, titleKey: 'privacyTitle', descKey: 'privacyDesc' },
  {
    href: '/settings/agent-security',
    icon: ShieldCheck,
    titleKey: 'agentSecurityTitle',
    descKey: 'agentSecurityDesc',
  },
  {
    href: '/settings/data-export',
    icon: Download,
    titleKey: 'dataExportTitle',
    descKey: 'dataExportDesc',
  },
  {
    href: '/settings/authorizations',
    icon: Key,
    titleKey: 'authorizationsTitle',
    descKey: 'authorizationsDesc',
  },
  {
    href: '/settings/security-log',
    icon: FileText,
    titleKey: 'securityLogTitle',
    descKey: 'securityLogDesc',
  },
  {
    href: '/settings/login-security',
    icon: LogIn,
    titleKey: 'loginSecurityTitle',
    descKey: 'loginSecurityDesc',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    titleKey: 'notificationsTitle',
    descKey: 'notificationsDesc',
  },
] as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
