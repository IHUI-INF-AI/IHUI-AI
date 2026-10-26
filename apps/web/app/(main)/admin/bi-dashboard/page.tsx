// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingCart, Users, Activity, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import {
  CHART_BLUE,
  CHART_GREEN,
  CHART_AMBER,
  CHART_VIOLET,
  CHART_TEXT_LIGHT,
  CHART_INDIGO,
} from '@ihui/design-tokens'
import type { EChartsOption } from 'echarts'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

interface BiTrend {
  date: string
  revenue: number
  orders: number
}
interface BiCategory {
  name: string
  value: number
}
interface BiSource {
  name: string
  value: number
}
interface BiDashboardData {
  totalRevenue: number
  totalOrders: number
  newUsers: number
  activeUsers: number
  trend: BiTrend[]
  categories: BiCategory[]
  sources: BiSource[]
  /** 访问埋点块(2026-10-26):PV/UV 与页面排行,来自 visit_logs */
  visits: {
    pv: number
    uv: number
    pages: Array<{
      url: string
      platform: 'web' | 'rn' | 'mp' | 'ex'
      /** 访问面(前台/后台/登录页):判据与「访问面占比」同源,前端不再靠"看着像后台"猜 */
      scope: 'public' | 'admin' | 'auth'
      pv: number
      uv: number
    }>
    /** 近 7 日逐日 PV/UV(缺失日已由后端补 0) */
    daily: Array<{ date: string; pv: number; uv: number }>
  }
  /** 近 7 日各端使用量(分桶判据与监控大屏同源:前缀表单源) */
  platforms: Array<{ platform: 'web' | 'rn' | 'mp' | 'ex'; pv: number; uv: number }>
  /** 近 7 日访问面(前台/后台/登录页)PV/UV */
  faces: Array<{ scope: 'public' | 'admin' | 'auth'; pv: number; uv: number }>
  /** 近 7 日地域 TOP(city 由服务端按 IP 反查;反查不到写 (未知)) */
  cities: Array<{ city: string; pv: number; uv: number }>
  /** 近 7 日页面停留 TOP(page_time 均值;样本数 = 停留事件条数) */
  stays: Array<{
    page: string
    platform: 'web' | 'rn' | 'mp' | 'ex'
    scope: 'public' | 'admin' | 'auth'
    avgSec: number
    samples: number
  }>
  /**
   * 近 7 日访客构成(新访客 / 回访)。身份 = coalesce(session_id, ip),与 UV 同一把尺,
   * 所以 newUv + returningUv 恒等于窗口内 UV。null = 后端那条腿取不到(渲染"暂无法统计")。
   */
  audience: {
    newUv: number
    returningUv: number
    activeUv: number
    returningRate: number | null
  } | null
  /** 近 7 日浏览器分布(只算 web 裸路径,RN/小程序/插件另见「各端使用量」);null = 取不到 */
  browsers: Array<{ family: string; pv: number; uv: number }> | null
}

/** 加载失败时的诚实空态(全 0/空数组),避免用假数字冒充真实运营数据 */
const EMPTY: BiDashboardData = {
  totalRevenue: 0,
  totalOrders: 0,
  newUsers: 0,
  activeUsers: 0,
  trend: [],
  categories: [],
  sources: [],
  visits: { pv: 0, uv: 0, pages: [], daily: [] },
  platforms: [],
  faces: [],
  cities: [],
  stays: [],
  audience: null,
  browsers: null,
}

/** UA 家族 → 界面文案。`unknown` 主要是探活/脚本类上报(不带 UA),明写出来免得读成"埋点坏了"。 */
const BROWSER_LABEL: Record<string, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  safari: 'Safari',
  firefox: 'Firefox',
  opera: 'Opera',
  wechat: '微信内置浏览器',
  unknown: '未知(探针/脚本)',
  other: '其他',
}

/** 端标签与徽章配色:与「访问统计」页同一套分桶语义(web 裸路径 / rn / mp / ex 前缀)。 */
const PLATFORM_LABEL: Record<'web' | 'rn' | 'mp' | 'ex', string> = {
  web: '网站',
  rn: '移动端',
  mp: '小程序',
  ex: '浏览器插件',
}
const PLATFORM_BADGE_CLASS: Record<'web' | 'rn' | 'mp' | 'ex', string> = {
  web: 'bg-muted text-foreground',
  rn: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  mp: 'bg-green-500/10 text-green-700 dark:text-green-400',
  ex: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
}

/** 访问面(前台/后台/登录页)——与后端 visitScopeCaseSql 同一套分桶值。 */
const FACE_LABEL: Record<'public' | 'admin' | 'auth', string> = {
  public: '前台',
  admin: '后台',
  auth: '登录页',
}
const FACE_BADGE_CLASS: Record<'public' | 'admin' | 'auth', string> = {
  public: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  auth: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}

/**
 * 页面行上的访问面徽章:前台是该表的默认形态,只标「后台 / 登录页」两类,
 * 否则每行两个徽章把路径挤到截断。未标即前台(判据来自后端 classifyVisitScope,不是前端猜)。
 */
function FaceBadge({ scope }: { scope: 'public' | 'admin' | 'auth' }) {
  if (scope === 'public') return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${FACE_BADGE_CLASS[scope]}`}
    >
      {FACE_LABEL[scope]}
    </span>
  )
}

const STAT_CARDS = [
  { key: 'totalRevenue' as const, label: '总营收', icon: TrendingUp, color: 'text-emerald-600' },
  { key: 'totalOrders' as const, label: '总订单', icon: ShoppingCart, color: 'text-teal-600' },
  { key: 'newUsers' as const, label: '新增用户', icon: Users, color: 'text-purple-600' },
  { key: 'activeUsers' as const, label: '活跃用户', icon: Activity, color: 'text-orange-600' },
]

export default function BiDashboardPage() {
  const { data, isLoading, error } = useQuery<BiDashboardData>({
    queryKey: ['bi-dashboard'],
    queryFn: async () => {
      const r = await fetchApi<BiDashboardData>('/api/admin/bi-dashboard')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    staleTime: 60_000,
  })
  const d = data ?? EMPTY
  // 2026-10-26:后端旧版本缺块时不得让 .map 崩掉整页(此前 trend/categories/sources
  // 三个字段后端根本没返回 ⇒ 打开就是错误边界)。这里逐块兜底成空数组。
  const trendRows = d.trend ?? []
  const categoryRows = d.categories ?? []
  const sourceRows = d.sources ?? []
  const visitPages = d.visits?.pages ?? []
  const visitDaily = d.visits?.daily ?? []
  const stays = d.stays ?? []
  const audience = d.audience ?? null
  const browsers = d.browsers ?? null
  const platforms = d.platforms ?? []
  const faces = d.faces ?? []
  const cities = d.cities ?? []

  const visitTrendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['浏览量 PV', '访客数 UV'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: visitDaily.map((t) => t.date.slice(5)),
      boundaryGap: false,
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '浏览量 PV',
        type: 'line',
        smooth: true,
        data: visitDaily.map((t) => t.pv),
        itemStyle: { color: CHART_BLUE },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '访客数 UV',
        type: 'line',
        smooth: true,
        data: visitDaily.map((t) => t.uv),
        itemStyle: { color: CHART_GREEN },
      },
    ],
  }

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['营收', '订单'], top: 0 },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trendRows.map((t) => t.date), boundaryGap: false },
    yAxis: [
      { type: 'value', name: '营收(元)' },
      { type: 'value', name: '订单' },
    ],
    series: [
      {
        name: '营收',
        type: 'line',
        smooth: true,
        data: trendRows.map((t) => t.revenue),
        itemStyle: { color: CHART_BLUE },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '订单',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: trendRows.map((t) => t.orders),
        itemStyle: { color: CHART_GREEN },
      },
    ],
  }

  const categoryOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: categoryRows.map((c) => c.name) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: categoryRows.map((c) => c.value),
        itemStyle: { color: CHART_INDIGO, borderRadius: [4, 4, 0, 0] },
        barWidth: '50%',
      },
    ],
  }

  const sourceOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: sourceRows.map((s) => ({ name: s.name, value: s.value })),
        color: [CHART_BLUE, CHART_GREEN, CHART_AMBER, CHART_VIOLET, CHART_TEXT_LIGHT],
      },
    ],
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold">BI 仪表板</h1>
        <p className="mt-1 text-sm text-muted-foreground">业务核心指标与趋势可视化</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          BI 数据加载失败:{(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-6">
        {STAT_CARDS.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '—' : formatNumber(d[c.key] as number)}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {[
          { key: 'pv' as const, label: '近 7 日浏览量', sub: 'UV', icon: Eye },
          { key: 'uv' as const, label: '近 7 日访客数', sub: 'PV', icon: Users },
        ].map((c) => {
          const Icon = c.icon
          const main = d.visits?.[c.key] ?? 0
          const sub = d.visits?.[c.sub === 'UV' ? 'uv' : 'pv'] ?? 0
          return (
            <Card key={c.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '—' : formatNumber(main)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.sub} {isLoading ? '—' : formatNumber(sub)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">7 天趋势</CardTitle>
            <p className="text-xs text-muted-foreground">营收与订单变化</p>
          </CardHeader>
          <CardContent>
            <EChart option={trendOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">近 7 日访问趋势</CardTitle>
            <p className="text-xs text-muted-foreground">
              每天被打开多少次（PV）与多少人到访（UV）
            </p>
          </CardHeader>
          <CardContent>
            <EChart option={visitTrendOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">分类对比</CardTitle>
            <p className="text-xs text-muted-foreground">各业务模块营收</p>
          </CardHeader>
          <CardContent>
            <EChart option={categoryOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">访问来源</CardTitle>
            <p className="text-xs text-muted-foreground">近 7 日 referer 主机（无来源记 direct）</p>
          </CardHeader>
          <CardContent>
            <EChart option={sourceOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">页面访问排行</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 每个页面被打开了多少次、多少去重访客（后台/登录页另标，未标的即前台）
          </p>
        </CardHeader>
        <CardContent>
          {visitPages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无访问数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visitPages.map((p) => {
                const max = visitPages[0]?.pv || 1
                const pct = Math.round((p.pv / max) * 100)
                return (
                  <div key={p.url} className="flex items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE_CLASS[p.platform]}`}
                    >
                      {PLATFORM_LABEL[p.platform]}
                    </span>
                    <FaceBadge scope={p.scope} />
                    <span className="w-[34%] truncate text-xs text-foreground">{p.url}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs tabular-nums">{p.pv}</span>
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                      UV {p.uv}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">页面停留时长 TOP</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 平均每次停留秒数（括号内为样本数；开着不动的后台页会顶高自己）
          </p>
        </CardHeader>
        <CardContent>
          {stays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无停留数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {stays.map((s) => {
                const max = stays[0]?.avgSec || 1
                const pct = Math.round((s.avgSec / max) * 100)
                return (
                  <div key={s.page} className="flex items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE_CLASS[s.platform]}`}
                    >
                      {PLATFORM_LABEL[s.platform]}
                    </span>
                    <FaceBadge scope={s.scope} />
                    <span className="w-[34%] truncate text-xs text-foreground">{s.page}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs tabular-nums">
                      {s.avgSec.toFixed(1)}s
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                      n={s.samples}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">访客构成</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 新访客与回访（与访客数同一身份口径）
          </p>
        </CardHeader>
        <CardContent>
          {audience === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无法统计'}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{audience.newUv}</span>
                <span className="text-xs text-muted-foreground">新访客</span>
                <span className="ml-auto text-2xl font-semibold tabular-nums">
                  {audience.returningUv}
                </span>
                <span className="text-xs text-muted-foreground">回访</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-primary/60"
                  style={{
                    width: `${
                      audience.returningRate === null ? 0 : Math.round(audience.returningRate * 100)
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  回访率{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {audience.returningRate === null
                      ? '—'
                      : `${Math.round(audience.returningRate * 100)}%`}
                  </span>
                </span>
                <span>
                  窗口内访客{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {audience.activeUv}
                  </span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">浏览器分布</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 仅网站裸路径（各端用量另见访问统计）
          </p>
        </CardHeader>
        <CardContent>
          {browsers === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无法统计'}
            </p>
          ) : browsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无浏览器数据</p>
          ) : (
            <div className="space-y-1.5">
              {browsers.map((b) => {
                const max = browsers[0]?.pv || 1
                const pct = Math.round((b.pv / max) * 100)
                return (
                  <div key={b.family} className="flex items-center gap-2">
                    <span className="w-[38%] truncate text-xs text-foreground">
                      {BROWSER_LABEL[b.family] ?? b.family}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-xs tabular-nums">{b.pv}</span>
                    <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                      人 {b.uv}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">各端使用量</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 网站 / 移动端 / 小程序 / 浏览器插件（次数 与 人数）
          </p>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无分端数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {(['web', 'rn', 'mp', 'ex'] as const).map((key) => {
                const row = platforms.find((p) => p.platform === key)
                const max = Math.max(...platforms.map((p) => p.pv), 1)
                const pv = row?.pv ?? 0
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className={`inline-flex w-[26%] items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE_CLASS[key]}`}
                    >
                      {PLATFORM_LABEL[key]}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${Math.round((pv / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs tabular-nums">
                      {pv}
                      <span className="text-muted-foreground"> / {row?.uv ?? 0}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">访问面占比</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 前台 / 后台 / 登录页各被打开多少次
          </p>
        </CardHeader>
        <CardContent>
          {faces.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无访问面数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {(['public', 'admin', 'auth'] as const).map((key) => {
                const row = faces.find((f) => f.scope === key)
                const max = Math.max(...faces.map((f) => f.pv), 1)
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className={`inline-flex w-[22%] shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${FACE_BADGE_CLASS[key]}`}
                    >
                      {FACE_LABEL[key]}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${Math.round(((row?.pv ?? 0) / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                      {row?.pv ?? 0}
                      <span className="text-muted-foreground"> / {row?.uv ?? 0}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">地域 TOP</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 服务端按 IP 反查（反查不到记为未知）
          </p>
        </CardHeader>
        <CardContent>
          {cities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无地域数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {cities.map((c) => {
                const max = cities[0]?.pv || 1
                return (
                  <div key={c.city} className="flex items-center gap-2">
                    <span className="w-[26%] truncate text-xs text-foreground">{c.city}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${Math.round((c.pv / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                      {c.pv}
                      <span className="text-muted-foreground"> / {c.uv}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
