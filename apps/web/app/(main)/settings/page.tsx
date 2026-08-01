'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { KeyRound, Bot } from 'lucide-react'

import { Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
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
import { DesktopSettingsCard } from './DesktopSettingsCard'
import { SIDEBAR_KEY, SUB_PAGES } from './helpers'

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
    <Container maxWidth="md" padding={false} className="space-y-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 min-[640px]:grid-cols-3">
          <TabsTrigger value="appearance">{t('appearance')}</TabsTrigger>
          <TabsTrigger value="security">{t('securityCenter')}</TabsTrigger>
          <TabsTrigger value="more">{t('subPagesTitle')}</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-3">
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            <ThemeCard t={t} mounted={mounted} theme={theme} onSelect={(k) => setTheme(k)} />
            <LanguageCard t={t} locale={locale} onSelect={switchLocale} />
            <SidebarCard t={t} collapsed={collapsed} onToggle={toggleCollapsed} />
            <MiniappQrCard t={t} />
            <DesktopSettingsCard />
            <ThemeBackupSync />
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-3">
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

        <TabsContent value="more" className="mt-3">
          <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            <Link href="/settings/api-keys">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start gap-2 p-3">
                  <div className="rounded-md bg-muted p-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">API 密钥</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">管理开发者 API 密钥</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/settings/llm">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start gap-2 p-3">
                  <div className="rounded-md bg-muted p-1.5">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">LLM 配置</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      配置你自己的 LLM API Key(BYOK),支持 OpenAI / Anthropic / DeepSeek /
                      智谱等大厂。平台只收 5-20% 服务费,免费 provider 不收费。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            {SUB_PAGES.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}>
                  <Card className="transition-colors hover:bg-accent">
                    <CardContent className="flex items-start gap-2 p-3">
                      <div className="rounded-md bg-muted p-1.5">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{t(item.titleKey)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t(item.descKey)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </Container>
  )
}
