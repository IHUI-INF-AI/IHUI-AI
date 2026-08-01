'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Globe, Languages, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent, Switch, Button } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { useDesktop } from '@/hooks/use-desktop'
import { clearWebViewCache } from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'sidebar-collapsed'

export default function PreferencesPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const [cacheCleaning, setCacheCleaning] = React.useState(false)
  const { isDesktop } = useDesktop()

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

  const handleClearCache = async () => {
    setCacheCleaning(true)
    try {
      const result = await clearWebViewCache()
      if (result.ok) {
        toast.success(t('cacheCleanSuccess'))
      } else {
        toast.error(t('cacheCleanFailed'))
      }
    } catch {
      toast.error(t('cacheCleanFailed'))
    } finally {
      setCacheCleaning(false)
    }
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
        <h1 className="text-2xl font-bold tracking-tight">{t('preferencesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('preferencesDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4" />
            {t('theme')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 min-[640px]:grid-cols-3 gap-2">
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
            <Switch checked={collapsed} onCheckedChange={toggleCollapsed} />
          </div>
        </CardContent>
      </Card>

      {isDesktop && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4" />
              {t('cacheCleanTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                {t('cacheCleanDesc')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={cacheCleaning}
              >
                {t('cacheCleanButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
