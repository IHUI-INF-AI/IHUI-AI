// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { ChevronRight, Palette } from 'lucide-react'

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
  const ta = useTranslations('appearanceSettings')
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
    <div className="px-4 space-y-3 py-4">
      <BackButton />
      <Tabs defaultValue="appearance" className="flex w-full flex-col gap-3">
        <TabsList className="grid w-full shrink-0 grid-cols-2 self-start">
          <TabsTrigger value="appearance">{t('appearance')}</TabsTrigger>
          <TabsTrigger value="security">{t('securityCenter')}</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="min-h-0">
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            {/* 2026-11-15:外观与排版的统一入口(字号/字重/行高/宽度/详细度/AI 回复风格) */}
            <Link
              href="/settings/appearance"
              data-testid="settings-appearance-entry"
              className="group flex items-center gap-3 rounded-sm border p-4 transition-colors hover:bg-accent min-[640px]:col-span-2"
            >
              <Palette className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-body font-medium">{ta('title')}</div>
                <p className="mt-0.5 text-label text-muted-foreground">{ta('subtitle')}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
