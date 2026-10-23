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
import { ChevronsLeft, ChevronsRight, RefreshCw, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Tooltip } from '@/components/feedback'
import { PageContainer } from '@/components/common/PageContainer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
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

type MonitorView = 'panels' | 'wallboard'

/**
 * 选中态三档实测后的定档(2026-10-20,暗色档计算样式现读):
 *   bg-selection = rgb(0,0,0) 纯黑,压在 bg-muted rgb(38,38,38) 的槽上 ⇒ 比底还暗,读成"未选中";
 *   bg-background = rgb(36,36,36) ⇒ 与槽只差 2,等于看不见;
 *   唯一在两档都成立的高对比对是品牌实底对 `bg-cta`/`text-cta-foreground`(暗=纯白底黑字、
 *   亮=纯黑底白字,tokens.css .dark 现读 hsl(0 0% 100%)/hsl(0 0% 0%))。共享 Tabs 的默认档
 *   (packages/ui-react/src/components/tabs.tsx 的 bg-selection)在暗色下是同型坑,源头修归设计系统,
 *   这里先按调用点覆写并留证据。
 */
const TRIGGER_CLS =
  'h-7 px-3 text-[12px] font-medium data-[state=active]:bg-cta data-[state=active]:text-cta-foreground'

/**
 * 两种呈现的切换器。刻意不自己占一行:由各视图的顶栏承载,复用共享 Tabs 档位
 * (机主 2026-10-20 定档:切换件要显眼,但不许把内容往下挤一行)。
 *
 * 只有 `TabsList` + `TabsTrigger`,没有自己的 `Tabs` 根:根由页面持有,这里从 Radix
 * context 取当前值。本组件经 `headerExtra` 槽渲染在 `TabsContent` 内部,仍在根的子孙树里
 * ⇒ context 取得到。若这里再套一个根,整页会有两根,而两根都没有 `TabsContent` ⇒ 每个
 * trigger 的 `aria-controls` 都指向不存在的 id、整页没有 `role=tabpanel`(仓里其它页如
 * `app/(main)/agent-runtime/page.tsx` 都是"根包 List + Content"的写法)。
 */
function MonitorViewSwitch() {
  return (
    <TabsList className="h-9 shrink-0">
      <TabsTrigger value="panels" className={TRIGGER_CLS}>
        监控面板
      </TabsTrigger>
      <TabsTrigger value="wallboard" className={TRIGGER_CLS}>
        数据大屏
      </TabsTrigger>
    </TabsList>
  )
}

export default function MonitorPanelsPage() {
  const [view, setView] = React.useState<MonitorView>('panels')

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'wallboard') {
      setView('wallboard')
    }
  }, [])

  const switchView = (next: MonitorView) => {
    setView(next)
    const url = new URL(window.location.href)
    if (next === 'wallboard') url.searchParams.set('view', 'wallboard')
    else url.searchParams.delete('view')
    window.history.replaceState(null, '', url.toString())
  }

  const headerExtra = <MonitorViewSwitch />

  return (
    <PageContainer padded={false} className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={view}
        onValueChange={(v) => switchView(v as MonitorView)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* 面板视图自带「侧栏 + 面板区」两条独立滚动腿,外层不能再滚,否则会多出一层嵌套滚动 */}
        <TabsContent
          value="panels"
          className="wb-scroll-host mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <MonitorPanelsContent headerExtra={headerExtra} />
        </TabsContent>
        {/* 大屏视图由本层滚动:粘性顶栏相对它定位 */}
        <TabsContent
          value="wallboard"
          className="wb-scroll-host mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <WallboardView headerExtra={headerExtra} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function MonitorPanelsContent({ headerExtra }: { headerExtra: React.ReactNode }) {
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
  const shellRef = React.useRef<HTMLDivElement | null>(null)
  const navTouched = React.useRef(false)

  // 工作区宽度 ≠ 视口宽度(左侧 AI 面板展开时可占掉一半)。224px 侧栏在窄容器里会把
  // 面板区压到 660px 以下,所以按容器宽自动收起;用户手动切过之后不再自动干预。
  React.useEffect(() => {
    const el = shellRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (navTouched.current) return
      setNavOpen((entry?.contentRect.width ?? 0) >= 900)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toggleNav = () => {
    navTouched.current = true
    setNavOpen((v) => !v)
  }

  // 配置 chunk 懒加载(首次进入拉取一次,随后走模块缓存)
  React.useEffect(() => {
    let alive = true
    void loadConfig().then((m) => {
      if (!alive) return
      setConfig(m)
      // 默认落地盘 = 全景(2026-10-23 机主拍板)。此前取数组第一张,而生成器按文件名字典序
      // 排 ⇒ 落在「Agent 与工具链路」,全景、访客与号池这些"一眼看全局"的盘都得翻页才看得到
      // (机主原话:"我也没看到有啥变化啊")。取不到全景时回落到第一张,不改变兜底行为。
      setActiveUid(
        (u) =>
          u ||
          (m.MONITOR_DASHBOARDS.find((d) => d.uid === 'ihui-ai-overview')?.uid ??
            m.MONITOR_DASHBOARDS[0]!.uid),
      )
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
    let failed = false
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
          failed = true
          break
        }
        if (!res.success || !res.data) {
          setPageError(res.error || '查询失败')
          failed = true
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
      // 失败时保留上一轮结果(与行内提示同现);不落半批结果,避免新旧窗口混在同一盘,updatedAt 也不推进
      if (!failed) {
        setResults(next)
        setUpdatedAt(new Date())
        setCountdown(AUTO_REFRESH_MS / 1000)
      }
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
    <div ref={shellRef} className="flex min-h-0 flex-1 overflow-hidden">
      {/* 左侧导航:21 张盘,按分组 */}
      <aside
        className={cn(
          'pn-nav shrink-0 overflow-y-auto bg-card/60 transition-[width] duration-200',
          navOpen ? 'w-56' : 'w-12',
        )}
      >
        <Tooltip content={navOpen ? '收起面板列表' : '展开面板列表'}>
          <button
            type="button"
            onClick={toggleNav}
            className={cn(
              'sticky top-0 z-10 flex w-full items-center gap-2 bg-card/95 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground',
              !navOpen && 'justify-center px-0',
            )}
          >
            {navOpen ? (
              <>
                <span className="truncate">监控面板</span>
                <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums">
                  {boards.length}
                </span>
                <ChevronsLeft className="ml-auto h-3.5 w-3.5 shrink-0" />
              </>
            ) : (
              <ChevronsRight className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
        {navOpen &&
          (!config ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">配置加载中…</div>
          ) : (
            groups.map((group) => {
              const groupBoards = boards.filter((d) => d.group === group)
              if (!groupBoards.length) return null
              return (
                <div key={group} className="mb-2">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {group}
                  </div>
                  <div className="space-y-0.5 px-1.5">
                    {groupBoards.map((d) => {
                      const label = stripBrandPrefix(d.title)
                      const active = d.uid === activeUid
                      return (
                        <Tooltip key={d.uid} content={label}>
                          <button
                            type="button"
                            onClick={() => switchDashboard(d.uid)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                              active
                                ? 'bg-info/15 font-medium text-info-text'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                active ? 'bg-info' : 'bg-border',
                              )}
                            />
                            <span className="truncate">{label}</span>
                          </button>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ))}
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏:标题 + 呈现切换固定在同一行首,工具组靠右;窄容器时工具组整体换行,顺序不乱 */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
              {dashboard ? stripBrandPrefix(dashboard.title) : '监控面板'}
            </h2>
            {dashboard && (
              <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
                {filter.trim()
                  ? `${panels.length}/${dashboard.panels.length}`
                  : dashboard.panels.length}
              </span>
            )}
          </div>
          {headerExtra}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="筛选面板…"
                className="h-7 w-32 rounded-sm border border-border bg-muted/50 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-info/40 focus:outline-none"
              />
            </div>
            <div className="flex h-7 items-center overflow-hidden rounded-sm border border-border bg-muted/40">
              {RANGES.map((r) => (
                <button
                  key={r.seconds}
                  type="button"
                  onClick={() => setRangeSec(r.seconds)}
                  className={cn(
                    'h-full px-2 text-[11px] transition-colors',
                    rangeSec === r.seconds
                      ? 'bg-info/15 text-info-text'
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
                'flex h-7 items-center gap-1 rounded-sm border px-2 text-[11px] tabular-nums transition-colors',
                autoRefresh
                  ? 'border-info/40 text-info-text'
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
              className="h-7 rounded-sm border border-border px-2 text-[11px] text-foreground transition-colors hover:border-info/40 hover:text-info-text disabled:opacity-50"
            >
              刷新
            </button>
            {updatedAt && (
              <span className="text-[10px] tabular-nums text-muted-foreground">
                更新于 {updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
            )}
          </div>
        </div>

        {pageError && (
          <div className="border border-warning/25 bg-warning/5 px-4 py-1.5 text-[11px] text-warning-text">
            {pageError}
          </div>
        )}

        {/* 面板网格:pn-panels 是网格列的容器查询宿主,列数跟面板区实际宽度走(不跟视口) */}
        <div className="pn-panels flex-1 overflow-y-auto p-3">
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
