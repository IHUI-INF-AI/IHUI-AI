/**
 * P1-2.3: Grafana iframe 包装组件
 *
 * 职责:
 * - 渲染 Grafana dashboard iframe(同源 localhost:8801)
 * - 透传 var-tenant 变量,自动锁定当前租户
 * - 时间范围:近 1h(实时监控场景)
 *
 * 注意:
 * - 仅在浏览器端渲染(Grafana 需要 cookie/header)
 * - Grafana 服务运行于 http://127.0.0.1:8801(production 需走反向代理)
 * - 若 NEXT_PUBLIC_GRAFANA_BASE 未配置,组件显示降级提示
 */
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ExternalLink, Maximize2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface GrafanaFrameProps {
  /** 当前租户标识(注入到 Grafana 模板变量 $tenant) */
  tenant: string
  /** Grafana dashboard UID(默认 saas-tenant-overview) */
  uid?: string
  /** 标题(可选,默认 i18n 翻译) */
  title?: string
  /** iframe 高度(默认 480) */
  height?: number
  /** 主题:light / dark / auto */
  theme?: 'light' | 'dark' | 'auto'
  /** 时间范围(Grafana 语法,如 "now-1h" / "now-6h") */
  timeRange?: string
  /** 刷新间隔(Grafana 语法,如 "15s" / "30s") */
  refresh?: string
  /** 紧凑模式:仅渲染 iframe,不带外层 Card(用于详情页内嵌) */
  bare?: boolean
}

const DEFAULT_UID = 'saas-tenant-overview'
const DEFAULT_BASE = process.env.NEXT_PUBLIC_GRAFANA_BASE ?? 'http://127.0.0.1:8801'

export function GrafanaFrame({
  tenant,
  uid = DEFAULT_UID,
  title,
  height = 480,
  theme = 'auto',
  timeRange = 'now-1h',
  refresh = '15s',
  bare = false,
}: GrafanaFrameProps) {
  const t = useTranslations('admin.saas.metrics')

  // 客户端 hydration 后才挂载 iframe(避免 SSR 期间请求 Grafana)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // SSR 期间不渲染
  if (!mounted) {
    if (bare) {
      return (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
          style={{ height }}
        >
          {t('loading')}
        </div>
      )
    }
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title ?? t('iframeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
            style={{ height }}
          >
            {t('loading')}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 检测 NEXT_PUBLIC_GRAFANA_BASE 是否配置
  const grafanaConfigured = Boolean(process.env.NEXT_PUBLIC_GRAFANA_BASE)
  const resolvedTitle = title ?? t('iframeTitle')

  // 构建 URL
  const params = new URLSearchParams({
    'var-tenant': tenant,
    from: timeRange,
    to: 'now',
    refresh,
    theme,
    kiosk: bare ? 'true' : 'false',
  })
  const src = `${DEFAULT_BASE}/d/${uid}?${params.toString()}`

  const frame = (
    <div className="relative overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        title={resolvedTitle}
        src={src}
        style={{ width: '100%', height, border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
      {!grafanaConfigured ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          {t('envHint')}
        </div>
      ) : null}
    </div>
  )

  if (bare) return frame

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {resolvedTitle}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-7 px-2 text-xs"
              title={t('openNewWindow')}
            >
              <a href={src} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-7 px-2 text-xs"
              title={t('openNewWindow')}
            >
              <a href={`${DEFAULT_BASE}/d/${uid}`} target="_blank" rel="noreferrer">
                <Maximize2 className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{frame}</CardContent>
    </Card>
  )
}

/** Grafana 服务不可达/未启动时的降级卡片 */
export function GrafanaUnavailableHint({ reason }: { reason?: string }) {
  const t = useTranslations('admin.saas.metrics')
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-6 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
        <div>
          <p className="font-medium text-foreground">{t('unavailableTitle')}</p>
          <p className="mt-1 text-xs">{reason ?? t('unavailableHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
