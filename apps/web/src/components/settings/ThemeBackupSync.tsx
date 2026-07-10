'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useTranslations, useLocale } from 'next-intl'
import { Download, Upload, Sparkles, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'

const SIDEBAR_KEY = 'sidebar-collapsed'
const THEME_BACKUP_KEY = 'theme-backup'

interface ThemeConfig {
  theme: string
  sidebar: string
  locale: string
  exportedAt: string
}

/**
 * 主题备份 / 同步 / 过渡：导出当前主题配置为 JSON、导入恢复、切换时平滑过渡。
 */
export function ThemeBackupSync() {
  const t = useTranslations('settings')
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [transitioning, setTransitioning] = React.useState(false)

  const buildConfig = (): ThemeConfig => ({
    theme: theme ?? 'system',
    sidebar: localStorage.getItem(SIDEBAR_KEY) ?? 'false',
    locale,
    exportedAt: new Date().toISOString(),
  })

  const handleExport = () => {
    const config = buildConfig()
    localStorage.setItem(THEME_BACKUP_KEY, JSON.stringify(config))
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `theme-config-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => fileRef.current?.click()

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const config = JSON.parse(text) as Partial<ThemeConfig>
      await smoothApply(config)
    } catch {
      /* ignore */
    }
    e.target.value = ''
  }

  // 平滑切换：先加过渡遮罩，应用配置后再淡出
  const smoothApply = async (config: Partial<ThemeConfig>) => {
    setTransitioning(true)
    await new Promise((r) => setTimeout(r, 200))

    if (config.theme) {
      setTheme(config.theme)
      localStorage.setItem('theme', config.theme)
    }
    if (config.sidebar !== undefined) {
      localStorage.setItem(SIDEBAR_KEY, config.sidebar)
    }
    if (config.locale && config.locale !== locale) {
      document.cookie = `locale=${config.locale};path=/;max-age=31536000`
    }
    localStorage.setItem(THEME_BACKUP_KEY, JSON.stringify(buildConfig()))

    await new Promise((r) => setTimeout(r, 300))
    setTransitioning(false)
    if (config.locale && config.locale !== locale) window.location.reload()
  }

  const handleQuickSwitch = async (target: string) => {
    if (target === theme) return
    await smoothApply({ theme: target })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          {t('themeBackup.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('themeBackup.desc')}</p>

        {/* 平滑快速切换 */}
        <div className="flex gap-2">
          {['light', 'dark', 'system'].map((th) => (
            <Button
              key={th}
              variant={theme === th ? 'default' : 'outline'}
              size="sm"
              disabled={transitioning}
              onClick={() => handleQuickSwitch(th)}
              className="flex-1"
            >
              {transitioning && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t(`theme${th.charAt(0).toUpperCase() + th.slice(1)}` as 'themeLight')}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('themeBackup.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportClick} className="flex-1">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {t('themeBackup.import')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* 过渡遮罩 */}
        {transitioning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
