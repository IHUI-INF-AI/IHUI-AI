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
