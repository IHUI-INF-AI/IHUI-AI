'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Globe, Languages, Check } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'sidebar-collapsed'

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
    <div className="mx-auto w-full max-w-3xl space-y-6">
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => toggleCollapsed(false)}
              className={cn(
                'rounded-lg border p-3 text-sm transition-colors',
                !collapsed
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t('sidebarExpanded')}
            </button>
            <button
              onClick={() => toggleCollapsed(true)}
              className={cn(
                'rounded-lg border p-3 text-sm transition-colors',
                collapsed
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t('sidebarCollapsed')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
