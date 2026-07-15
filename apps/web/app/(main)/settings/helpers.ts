import { LayoutDashboard, User, UserCircle, Receipt, Link2, Key, Settings, Activity, UserX, Shield, Download, FileText, Bell, CreditCard } from 'lucide-react'

export const SIDEBAR_KEY = 'sidebar-collapsed'

export const SUB_PAGES = [
  { href: '/settings/dashboard', icon: LayoutDashboard, titleKey: 'dashboardTitle', descKey: 'dashboardDesc' },
  { href: '/settings/profile', icon: User, titleKey: 'profileTitle', descKey: 'profileDesc' },
  { href: '/settings/avatar', icon: UserCircle, titleKey: 'avatarTitle', descKey: 'avatarDesc' },
  { href: '/settings/billing', icon: Receipt, titleKey: 'billingTitle', descKey: 'billingDesc' },
  { href: '/settings/connected-accounts', icon: Link2, titleKey: 'connectedAccountsTitle', descKey: 'connectedAccountsDesc' },
  { href: '/settings/llm', icon: Key, titleKey: 'llmConfigsTitle', descKey: 'llmConfigsDesc' },
  { href: '/settings/preferences', icon: Settings, titleKey: 'preferencesTitle', descKey: 'preferencesDesc' },
  { href: '/settings/activity', icon: Activity, titleKey: 'activityTitle', descKey: 'activityDesc' },
  { href: '/settings/account-deletion', icon: UserX, titleKey: 'accountDeletionTitle', descKey: 'accountDeletionDesc' },
  { href: '/settings/privacy', icon: Shield, titleKey: 'privacyTitle', descKey: 'privacyDesc' },
  { href: '/settings/data-export', icon: Download, titleKey: 'dataExportTitle', descKey: 'dataExportDesc' },
  { href: '/settings/authorizations', icon: Key, titleKey: 'authorizationsTitle', descKey: 'authorizationsDesc' },
  { href: '/settings/security-log', icon: FileText, titleKey: 'securityLogTitle', descKey: 'securityLogDesc' },
  { href: '/settings/notifications', icon: Bell, titleKey: 'notificationsTitle', descKey: 'notificationsDesc' },
  { href: '/settings/subscription', icon: CreditCard, titleKey: 'subscriptionTitle', descKey: 'subscriptionDesc' },
] as const
