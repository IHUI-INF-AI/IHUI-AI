'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
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
import { DesktopSettingsCard } from './DesktopSettingsCard'
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
    <div className="space-y-3 px-4 py-6">
      <BackButton />
      <Tabs defaultValue="appearance" className="flex w-full flex-col gap-3">
        <TabsList className="grid w-full shrink-0 grid-cols-2 self-start">
          <TabsTrigger value="appearance">{t('appearance')}</TabsTrigger>
          <TabsTrigger value="security">{t('securityCenter')}</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="min-h-0">
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            <ThemeCard t={t} mounted={mounted} theme={theme} onSelect={(k) => setTheme(k)} />
            <LanguageCard t={t} locale={locale} onSelect={switchLocale} />
            <SidebarCard t={t} collapsed={collapsed} onToggle={toggleCollapsed} />
            <MiniappQrCard t={t} />
            <DesktopSettingsCard />
            <ThemeBackupSync />
          </div>
        </TabsContent>

        <TabsContent value="security" className="min-h-0">
          <Alert variant="info" title={t('securityCenter')} closable />
          <div className="mt-2 grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            <SecurityScore />
            <TwoFactorAuth />
            <DeviceManager />
            <SessionManager />
            <IpWhitelist />
            <LoginHistory />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
