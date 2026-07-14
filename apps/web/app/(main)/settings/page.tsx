'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Languages,
  Check,
  Smartphone,
  UserX,
  Shield,
  Download,
  Key,
  FileText,
  Bell,
  CreditCard,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { Container } from '@/components/layout'
import { Switch } from '@/components/form'
import { cn } from '@/lib/utils'
import {
  DeviceManager,
  IpWhitelist,
  LoginHistory,
  SecurityScore,
  SessionManager,
  TwoFactorAuth,
  ThemeBackupSync,
} from '@/components/settings'

const SIDEBAR_KEY = 'sidebar-collapsed'

const SUB_PAGES = [
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
    href: '/settings/notifications',
    icon: Bell,
    titleKey: 'notificationsTitle',
    descKey: 'notificationsDesc',
  },
  {
    href: '/settings/subscription',
    icon: CreditCard,
    titleKey: 'subscriptionTitle',
    descKey: 'subscriptionDesc',
  },
] as const

export default function SettingsPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true')
  }, [])

  const toggleCollapsed = (v: boolean) => {
    setCollapsed(v)
    localStorage.setItem(SIDEBAR_KEY, String(v))
  }

  const switchLocale = (l: string) => {
    if (l === locale) return
    document.cookie = `locale=${l};path=/;max-age=31536000`
    window.location.reload()
  }

  const themes = [
    { key: 'light', icon: Sun, label: t('themeLight') },
    { key: 'dark', icon: Moon, label: t('themeDark') },
    { key: 'system', icon: Monitor, label: t('themeSystem') },
  ] as const

  const locales = [
    { key: 'zh-CN', label: t('langZh') },
    { key: 'en', label: t('langEn') },
  ] as const

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4" />
            {t('theme')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((item) => {
              const Icon = item.icon
              const active = mounted && theme === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setTheme(item.key)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4" />
            {t('language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {locales.map((item) => {
              const active = locale === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => switchLocale(item.key)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Globe className="h-4 w-4" />
                  {item.label}
                  {active && <Check className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            {t('sidebar')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {collapsed ? t('sidebarCollapsed') : t('sidebarExpanded')}
            </span>
            <Switch checked={collapsed} onChange={toggleCollapsed} />
          </div>
        </CardContent>
      </Card>

      {/* 小程序二维码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" />
            {t('miniappQr')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/common/miniapp-qr.png"
              alt={t('miniappQr')}
              className="h-48 w-48 rounded-lg border"
              loading="lazy"
            />
            <p className="text-sm text-muted-foreground">{t('miniappQrDesc')}</p>
          </div>
        </CardContent>
      </Card>

      {/* 主题备份 / 同步 / 平滑过渡 */}
      <ThemeBackupSync />

      {/* 安全中心 */}
      <div className="space-y-2 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{t('securityCenter')}</h2>
      </div>
      <Alert variant="info" title={t('securityCenter')} closable />
      <SecurityScore />
      <TwoFactorAuth />
      <DeviceManager />
      <SessionManager />
      <IpWhitelist />
      <LoginHistory />

      <div className="space-y-2 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{t('subPagesTitle')}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUB_PAGES.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-lg bg-muted p-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(item.descKey)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
