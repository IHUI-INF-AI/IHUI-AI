// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * P1-2.3 Grafana iframe 包装组件 → 2026-10-18 原生化重写。
 *
 * 李总裁决「彻底融合进项目,不可以单独搞出一个程序」+ Grafana 服务退役后,
 * 本组件改为直接复用项目原生面板机制:同一个查询 API
 * (/api/admin/monitor-panels/query,requireAdmin)+ 共享渲染层(panel-render),
 * 渲染「多租户业务监控」盘(ihui-ai-tenant-usage)。
 *
 * 诚实口径(零假数据):prom 标签 tenant_id 是 UUID,而 SaaS 侧租户对象只有
 * slug,无 slug→UUID 映射 ⇒ 不做"逐租户过滤"的假象,固定渲染全租户对比视图,
 * 由读者在图表里看自己关心的租户序列。
 *
 * 兼容性:uid/theme/timeRange/refresh 形参保留但不再生效(历史上指向的
 * saas-tenant-overview/comparison 两张盘在仓内从未存在,iframe 本就是死链)。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import { fetchApi } from '@/lib/api'
import { MONITOR_DASHBOARDS, type NativeDashboard } from '../../monitor/panels/dashboard-config.generated'
import { DashboardGrid, materializeExpr, stepFor, type QueryResult } from '../../monitor/panels/panel-render'

interface GrafanaFrameProps {
  /** 当前租户标识(历史形参;prom 标签为 UUID 而 SaaS 侧只有 slug,不再做逐租户过滤) */
  tenant: string
  /** 历史 Grafana dashboard UID(saas-* 盘从未存在,忽略) */
  uid?: string
  /** 标题(可选,默认 i18n 翻译) */
  title?: string
  /** 高度(默认 480) */
  height?: number
  /** 历史形参,不再生效 */
  theme?: 'light' | 'dark' | 'auto'
  /** 历史形参,不再生效(固定近 1h) */
  timeRange?: string
  /** 历史形参,不再生效(固定 30s 自动刷新) */
  refresh?: string
  /** 紧凑模式:不带外层 Card(用于详情页内嵌) */
  bare?: boolean
}

const FALLBACK_UID = 'ihui-ai-tenant-usage'
const RANGE_SEC = 3600
const AUTO_REFRESH_MS = 30_000

function resolveDashboard(uid?: string): NativeDashboard {
  return (
    MONITOR_DASHBOARDS.find((d) => d.uid === uid) ??
    MONITOR_DASHBOARDS.find((d) => d.uid === FALLBACK_UID) ??
    MONITOR_DASHBOARDS[0]!
  )
}

export function GrafanaFrame({ tenant: _tenant, uid, title, height = 480, bare = false }: GrafanaFrameProps) {
  const t = useTranslations('admin.saas.metrics')
  const dash = React.useMemo(() => resolveDashboard(uid), [uid])
  const [results, setResults] = React.useState<Map<number, QueryResult>>(new Map())
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const inFlight = React.useRef(false)

  const load = React.useCallback(async (d: NativeDashboard) => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setError('')
    try {
      const queries: Array<{ ref: string; expr: string; backend: 'prometheus' | 'loki'; rangeSeconds?: number; stepSeconds?: number }> = []
      const idx: Array<{ panelIdx: number; targetIdx: number }> = []
      const stepSec = stepFor(RANGE_SEC)
      d.panels.forEach((p, pi) => {
        const instant = p.kind === 'stat' || p.kind === 'gauge' || p.kind === 'table'
        p.targets.forEach((tg, ti) => {
          queries.push({
            ref: `q${queries.length}`,
            expr: materializeExpr(tg.expr, RANGE_SEC, stepSec),
            backend: p.backend,
            ...(instant ? {} : { rangeSeconds: RANGE_SEC, stepSeconds: stepSec }),
          })
          idx.push({ panelIdx: pi, targetIdx: ti })
        })
      })
      const next = new Map<number, QueryResult>()
      for (let i = 0; i < queries.length; i += 96) {
        const res = await fetchApi<{ results: QueryResult[] }>('/api/admin/monitor-panels/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: queries.slice(i, i + 96) }),
          timeoutMs: 60_000,
        })
        if (!res.success || !res.data) {
          setError(res.error || '查询失败')
          break
        }
        res.data.results.forEach((r, bi) => {
          const f = idx[i + bi]
          if (f) next.set(f.panelIdx * 1000 + f.targetIdx, r)
        })
      }
      setResults(next)
    } catch (e) {
      setError(`网络异常:${String((e as Error).message).slice(0, 120)}`)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load(dash)
    const timer = setInterval(() => void load(dash), AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [dash, load])

  if (error && results.size === 0) {
    return <GrafanaUnavailableHint reason={error} />
  }

  const grid = (
    <div className="overflow-y-auto rounded-lg border border-border bg-[#070d1a] p-3" style={{ height }}>
      <DashboardGrid dash={dash} panels={dash.panels} results={results} loading={loading} />
    </div>
  )

  if (bare) return grid
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title ?? t('iframeTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>{grid}</CardContent>
    </Card>
  )
}

/** 数据面不可达时的降级卡片(保留原导出,metrics 页在用) */
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
