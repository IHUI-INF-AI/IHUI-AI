// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 监控面板(/admin/monitor/panels)—— 21 张监控大屏的原生项目内渲染页。
 *
 * 2026-10-18 按李总指示「彻底融合进项目,不可以单独搞出一个程序」重写:
 * 不再内嵌外部看板程序,改为
 *   页面(本文件,项目自己的 EChart 组件) → /api/admin/monitor-panels/query
 *   → Prometheus(8815) / Loki(3100) 直查出图。
 * 面板定义(`monitoring/grafana/dashboards/*.json`)降级为离线配置源:表达式由
 * scripts/generate-monitor-panels.mjs 从上述 JSON 转译进 dashboard-config.generated.ts,
 * 运行时用户完全不接触外部看板程序。零假数据:所有曲线/数字都来自真实指标。
 */
import * as React from 'react'
import { RefreshCw, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Tooltip } from '@/components/feedback'
import type { NativeDashboard } from './dashboard-config.generated'
import { rkey, materializeExpr, stepFor, DashboardGrid } from './panel-render'
import type { QueryResult } from './panel-render'
import { WallboardView } from '../wallboard/page'

// ---------- 时间窗与步长 ----------

// Grafana 盘标题统一带品牌前缀;本页已在 IHUI AI 内,再显一遍只是噪声。
const stripBrandPrefix = (title: string) => title.replace(/^IHUI-AI(?:\s*·\s*|\s+)/, '')

const RANGES = [
  { label: '1小时', seconds: 3600 },
  { label: '3小时', seconds: 3 * 3600 },
  { label: '6小时', seconds: 6 * 3600 },
  { label: '24小时', seconds: 24 * 3600 },
  { label: '7天', seconds: 7 * 86400 },
] as const

const AUTO_REFRESH_MS = 30_000

// 配置体积 3000+ 行(已 331 条表达式),静态 import 会进首屏 bundle;运行期动态
// import 让 Next 把它切成独立 chunk,本页打开时才拉取(类型仍静态导入,零成本)。
// 类型用 ReturnType<typeof loadConfig> 推导(规避 `import()` 字面量,过 consistent-type-imports 门)。
//
// ⚠ 2026-10-19 修:这里原来是「返回类型注解写 ConfigModule」+「ConfigModule 又由
//   ReturnType<typeof loadConfig> 推导」——**自我循环**。TS 在配置规模小时能靠推断链
//   兜过去,盘从 21 张加到 29 张(331 条表达式)后推断链断裂,`next build` 直接挂:
//     TS2577 Return type annotation circularly references itself(43,24)
//     TS2456 Type alias 'ConfigModule' circularly references itself(46,6)
//     连带 6 条 TS7006(ConfigModule 解析失败 ⇒ 下游参数全部退化成隐式 any)
//   修法只拿掉显式返回类型注解 —— 依赖变成单向(ConfigModule ← loadConfig),
//   循环消失,且不写 `import()` 字面量这一条(comment 42 行)原样保住。
async function loadConfig() {
  return import('./dashboard-config.generated')
}
type ConfigModule = Awaited<ReturnType<typeof loadConfig>>

// ---------- 页面主体 ----------

export default function MonitorPanelsPage() {
  const [view, setView] = React.useState<'panels' | 'wallboard'>('panels')

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'wallboard') {
      setView('wallboard')
    }
  }, [])

  const switchView = (next: 'panels' | 'wallboard') => {
    setView(next)
    const url = new URL(window.location.href)
    if (next === 'wallboard') url.searchParams.set('view', 'wallboard')
    else url.searchParams.delete('view')
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-1 px-4">
      <div className="flex shrink-0 items-center justify-end">
        <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => switchView('panels')}
            className={cn(
              'rounded-sm px-2 py-0.5 text-[11px] transition-colors',
              view === 'panels'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            监控面板
          </button>
          <button
            type="button"
            onClick={() => switchView('wallboard')}
            className={cn(
              'rounded-sm px-2 py-0.5 text-[11px] transition-colors',
              view === 'wallboard'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            数据大屏
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {view === 'wallboard' ? (
          <div className="h-full overflow-hidden rounded-lg border border-border bg-background">
            <div className="h-full overflow-y-auto">
              <WallboardView />
            </div>
          </div>
        ) : (
          <MonitorPanelsContent />
        )}
      </div>
    </div>
  )
}

function MonitorPanelsContent() {
  const [config, setConfig] = React.useState<ConfigModule | null>(null)
  const [activeUid, setActiveUid] = React.useState<string>('')
  const [rangeSec, setRangeSec] = React.useState<number>(RANGES[1].seconds)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [pageError, setPageError] = React.useState('')
  const [results, setResults] = React.useState<Map<number, QueryResult>>(new Map())
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const [navOpen, setNavOpen] = React.useState(true)
  const [filter, setFilter] = React.useState('')
  const [countdown, setCountdown] = React.useState(AUTO_REFRESH_MS / 1000)
  const inFlight = React.useRef(false)

  // 配置 chunk 懒加载(首次进入拉取一次,随后走模块缓存)
  React.useEffect(() => {
    let alive = true
    void loadConfig().then((m) => {
      if (!alive) return
      setConfig(m)
      setActiveUid((u) => u || m.MONITOR_DASHBOARDS[0]!.uid)
    })
    return () => {
      alive = false
    }
  }, [])

  const dashboard = config?.MONITOR_DASHBOARDS.find((d) => d.uid === activeUid) ?? null

  const load = React.useCallback(async (dash: NativeDashboard, rSec: number) => {
    // 在飞防护:30s interval 不看上一次是否完成,批间慢于 30s 时新旧两次 load
    // 会竞争 setResults(旧响应可覆盖新响应)。ref 跨闭包共享状态。
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setPageError('')
    const queries: Array<{
      ref: string
      expr: string
      backend: 'prometheus' | 'loki'
      rangeSeconds?: number
      stepSeconds?: number
    }> = []
    const flat: Array<{ panelIdx: number; targetIdx: number }> = []
    const stepSec = stepFor(rSec)
    dash.panels.forEach((p, pi) => {
      // stat/gauge/table 用即时查询(最新值);其余走区间查询
      const instant = p.kind === 'stat' || p.kind === 'gauge' || p.kind === 'table'
      p.targets.forEach((t, ti) => {
        queries.push({
          ref: `q${queries.length}`,
          expr: materializeExpr(t.expr, rSec, stepSec),
          backend: p.backend,
          ...(instant ? {} : { rangeSeconds: rSec, stepSeconds: stepSec }),
        })
        flat.push({ panelIdx: pi, targetIdx: ti })
      })
    })
    const next = new Map<number, QueryResult>()
    try {
      // 同键(expr+backend+窗口)去重:同盘常见多面板共享同一表达式,只查一次上游
      const byKey = new Map<string, number[]>() // key -> queries 原始下标列表(含首个)
      const uniq: typeof queries = []
      const uniqOrig: number[] = [] // uniq[j] 对应 queries[uniqOrig[j]]
      const uniqFlat: Array<{ panelIdx: number; targetIdx: number }> = []
      queries.forEach((q, i) => {
        const key = `${q.backend}|${q.rangeSeconds ?? '-'}|${q.stepSeconds ?? '-'}|${q.expr}`
        const hit = byKey.get(key)
        if (hit) hit.push(i)
        else {
          byKey.set(key, [i])
          uniq.push(q)
          uniqOrig.push(i)
          uniqFlat.push(flat[i]!)
        }
      })
      // API 单次上限 96 条,分批(服务端已并发执行,批间串行即可)
      for (let i = 0; i < uniq.length; i += 96) {
        const batch = uniq.slice(i, i + 96)
        let res
        try {
          res = await fetchApi<{ results: QueryResult[] }>('/api/admin/monitor-panels/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: batch }),
            timeoutMs: 60_000,
          })
        } catch (e) {
          // 网络异常/请求中止:不静默,给出行内提示(数据保留旧值)
          setPageError(`网络异常:${String((e as Error).message).slice(0, 120)}`)
          break
        }
        if (!res.success || !res.data) {
          setPageError(res.error || '查询失败')
          break
        }
        res.data.results.forEach((r, bi) => {
          const j = i + bi
          const f = uniqFlat[j]
          if (!f) return
          next.set(rkey(f.panelIdx, f.targetIdx), r)
          // 克隆给共享同表达式的其余引用
          const origIdx = uniqOrig[j]!
          const q0 = queries[origIdx]!
          const key = `${q0.backend}|${q0.rangeSeconds ?? '-'}|${q0.stepSeconds ?? '-'}|${q0.expr}`
          for (const dup of byKey.get(key) ?? []) {
            if (dup === origIdx) continue
            const df = flat[dup]
            if (df) next.set(rkey(df.panelIdx, df.targetIdx), r)
          }
        })
      }
      setResults(next)
      setUpdatedAt(new Date())
      setCountdown(AUTO_REFRESH_MS / 1000)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (dashboard) void load(dashboard, rangeSec)
  }, [dashboard, rangeSec, load])

  React.useEffect(() => {
    if (!autoRefresh || !dashboard) return
    const t = setInterval(() => void load(dashboard, rangeSec), AUTO_REFRESH_MS)
    return () => clearInterval(t)
  }, [autoRefresh, dashboard, rangeSec, load])

  // 倒计时仅做显示(实际刷新由上面的 interval 驱动);每次数据落定即重置
  React.useEffect(() => {
    if (!autoRefresh) return
    const tick = setInterval(
      () => setCountdown((c) => (c <= 1 ? AUTO_REFRESH_MS / 1000 : c - 1)),
      1000,
    )
    return () => clearInterval(tick)
  }, [autoRefresh])
  React.useEffect(() => {
    setCountdown(AUTO_REFRESH_MS / 1000)
  }, [updatedAt])

  /** 切盘即清旧数据:避免新盘面板短暂显示上一盘的结果(键空间不同,语义上是脏数据)。 */
  const switchDashboard = (uid: string) => {
    if (uid === activeUid) return
    setActiveUid(uid)
    setResults(new Map())
    setUpdatedAt(null)
    setPageError('')
  }

  const groups = config?.PANEL_GROUPS ?? []
  const boards = config?.MONITOR_DASHBOARDS ?? []
  const panels = React.useMemo(() => {
    if (!dashboard) return []
    const q = filter.trim().toLowerCase()
    return q ? dashboard.panels.filter((p) => p.title.toLowerCase().includes(q)) : dashboard.panels
  }, [dashboard, filter])

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-border bg-background px-4">
      {/* 左侧导航:21 张盘,按分组 */}
      <aside
        className={cn(
          'shrink-0 overflow-y-auto border-r border-border bg-card transition-all',
          navOpen ? 'w-56' : 'w-12',
        )}
      >
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          className="w-full px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-cyan-300"
        >
          {navOpen ? `监控面板 (${boards.length})` : '»'}
        </button>
        {!config ? (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">配置加载中…</div>
        ) : (
          groups.map((group) => {
            const groupBoards = boards.filter((d) => d.group === group)
            if (!groupBoards.length) return null
            return (
              <div key={group} className="mb-2">
                {navOpen && (
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                )}
                {groupBoards.map((d) => {
                  const label = stripBrandPrefix(d.title)
                  return (
                    <Tooltip key={d.uid} content={label}>
                      <button
                        type="button"
                        onClick={() => switchDashboard(d.uid)}
                        className={cn(
                          'block w-full truncate px-3 py-1.5 text-left text-xs transition-colors',
                          d.uid === activeUid
                            ? 'border-l-2 border-cyan-400 bg-muted text-cyan-300'
                            : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {navOpen ? label : label.slice(0, 2)}
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
            )
          })
        )}
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
          <h2 className="text-sm font-semibold text-foreground">
            {dashboard ? stripBrandPrefix(dashboard.title) : '监控面板'}
          </h2>
          {dashboard && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {filter.trim()
                ? `${panels.length}/${dashboard.panels.length}`
                : dashboard.panels.length}{' '}
              面板
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="筛选面板…"
                className="w-32 rounded-sm border border-border bg-muted py-1 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-cyan-500/40 focus:outline-none"
              />
            </div>
            <div className="flex overflow-hidden rounded-sm border border-border">
              {RANGES.map((r) => (
                <button
                  key={r.seconds}
                  type="button"
                  onClick={() => setRangeSec(r.seconds)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] transition-colors',
                    rangeSec === r.seconds
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                'flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px]',
                autoRefresh
                  ? 'border-cyan-500/40 text-cyan-300'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <RefreshCw
                className={cn('h-3 w-3', autoRefresh && 'animate-spin')}
                style={autoRefresh ? { animationDuration: '3s' } : undefined}
              />
              {autoRefresh ? `${countdown}s` : '已暂停'}
            </button>
            <button
              type="button"
              onClick={() => dashboard && void load(dashboard, rangeSec)}
              disabled={loading || !dashboard}
              className="rounded-sm border border-border px-2 py-1 text-[11px] text-foreground hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
            >
              刷新
            </button>
            {updatedAt && (
              <span className="text-[10px] text-muted-foreground">
                更新于 {updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
            )}
          </div>
        </div>

        {pageError && (
          <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-[11px] text-amber-400">
            {pageError}
          </div>
        )}

        {/* 面板网格 */}
        <div className="flex-1 overflow-y-auto p-4">
          {!dashboard ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              配置加载中…
            </div>
          ) : panels.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              无匹配「{filter}」的面板
            </div>
          ) : (
            <DashboardGrid dash={dashboard} panels={panels} results={results} loading={loading} />
          )}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
