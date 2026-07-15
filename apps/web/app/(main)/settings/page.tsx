'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'

import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import {
  DeviceManager,
  IpWhitelist,
  LoginHistory,
  SecurityScore,
  SessionManager,
  TwoFactorAuth,
  ThemeBackupSync,
} from '@/components/settings'

import { ThemeCard } from './ThemeCard'
import { LanguageCard } from './LanguageCard'
import { SidebarCard } from './SidebarCard'
import { MiniappQrCard } from './MiniappQrCard'
import { SubPageGrid } from './SubPageGrid'
import { SIDEBAR_KEY } from './helpers'

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

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ThemeCard t={t} mounted={mounted} theme={theme} onSelect={(k) => setTheme(k)} />
      <LanguageCard t={t} locale={locale} onSelect={switchLocale} />
      <SidebarCard t={t} collapsed={collapsed} onToggle={toggleCollapsed} />
      <MiniappQrCard t={t} />

      <ThemeBackupSync />

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
      <SubPageGrid t={t} />
    </Container>
  )
}
