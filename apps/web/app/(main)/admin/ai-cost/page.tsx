// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Coins,
  TrendingUp,
  Database,
  BarChart3,
  Zap,
  Loader2,
  Layers,
  Boxes,
  AlertCircle,
  ArrowLeft,
  Wallet,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber as fmtNum } from '@/lib/date-utils'
import { TopUsersSection, BudgetAlertsSection, VipQuotasSection } from './AiCostSections'

interface AiCostSummary {
  totalCost: string | number
  totalTokens: number
  totalCalls: number
  cacheHitRate: number
}
/** 导出供 `buildModelChartData` 的调用方与 G-717 回归用例复用同一形状(纯类型,无运行时出口)。 */
export interface ByModel {
  model: string
  cost: string | number
  tokens: number
  calls: number
}
interface ByDay {
  date: string
  cost: string | number
  tokens: number
  calls: number
}
interface PromptCacheMetrics {
  hits: number
  misses: number
  l2Hits: number
  l2Misses: number
  errors: number
}
interface AiCostDashboard {
  summary: AiCostSummary
  byModel: ByModel[]
  byDay: ByDay[]
  period: { startDate: string; endDate: string }
  promptCacheMetrics?: PromptCacheMetrics
}
interface Budget {
  id: string
  scope: string
  scopeKey: string
  model: string | null
  dailyTokenLimit: number
  monthlyTokenLimit: number
  dailyCostLimit: string
  monthlyCostLimit: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AiCostDashboard = {
  summary: { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHitRate: 0 },
  byModel: [],
  byDay: [],
  period: { startDate: '', endDate: '' },
}

const hitRate = (h: number, m: number): string => {
  const total = h + m
  return total === 0 ? '—' : `${((h / total) * 100).toFixed(1)}%`
}

/* ------------------------------------------------------------------ *
 * G-717 —— 图表截断必须带余量行 + 脏日期不得炸整屏(真缺陷)
 *
 * 改前 HEAD 的两处病灶:
 *  1. `:265` 是 `d.byModel.slice(0, 10).map(...)`:第 11 个以后的模型被**静默丢弃** ——
 *     既无"其他"余量片也无总数说明,而同页卡片总额是按全量算的,于是
 *     "图上各行之和 ≠ 总额"。这属 §5e / 守门 77 记过的"静默变短=伪造完整性"同族,
 *     不是措辞偏好:读数对不上账时,人无从知道图被截过。
 *  2. `:303` 是 `dayFmt.format(new Date(row.date))`,把 API 的 dateKey 直接喂
 *     `Intl.DateTimeFormat`。脏值(空串 / `"2026-13-45"` / 任何 Date 解析不出的串)
 *     ⇒ Invalid Date ⇒ 抛 `RangeError: Invalid time value`,整张"按天"图连同页面一起炸。
 *     (回归用例 `tests/admin/g-717-*.test.ts` 里留了一条阳性对照:不加兜底的裸写法必须抛,
 *      否则那句"会炸整屏"就只是散文。)
 *
 * 口径抄上游 usage-stats 的既有形态:超限 ⇒ 前 N 条 + 一条真累加的"其他"片;
 * 占比按**全母**算(绝不按已展示小计归一);先过滤 0 值项;脏 dateKey ⇒ 原样返回
 * dateKey(不猜、不炸);非有限数 ⇒ `--` 而不是 `NaN` / `∞`。
 * ------------------------------------------------------------------ */

/** "按模型"图最多单独呈现的行数;超出部分折叠成一条"其他"余量片(总数仍如实标出)。 */
export const MODEL_CHART_ROW_LIMIT = 10

/** 非有限数(NaN / ±Infinity)的读数占位 —— 绝不把 `NaN` / `∞` 打进界面。 */
export const NUM_FALLBACK = '--'

/** 余量片在列表里的 React key(与任何真实模型名都不会撞,故不必加前缀消毒)。 */
export const OTHER_SLICE_KEY = '\u0000other'

/**
 * API 侧 cost 是 `string | number`(Drizzle numeric 直出),tokens/calls 是 number;
 * 任何非有限值都归 0,这样它既不进求和也不炸读数。
 */
export function toFiniteNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 数值读数:有限数交给 formatter,非有限数一律 `--`(而非 formatter 打出的 `NaN`/`∞`)。 */
export function formatFiniteNumber(fmt: Intl.NumberFormat, value: number): string {
  return Number.isFinite(value) ? fmt.format(value) : NUM_FALLBACK
}

/**
 * dateKey → 日轴标签。
 * 解析不出(脏值)时**原样返回 dateKey**,而不是抛 RangeError 把整屏炸掉 ——
 * 把没认出的值显示出来,永远比让它消失(或让页面崩)更可诊断。
 */
export function formatDayLabel(fmt: Intl.DateTimeFormat, dateKey: string): string {
  const ts = Date.parse(dateKey)
  return Number.isFinite(ts) ? fmt.format(new Date(ts)) : dateKey
}

/** 图表的一行。`isOther` 为真的那一行是被折叠出来的"其他"余量片。 */
export interface ModelChartRow {
  readonly model: string
  /** 费用,单位分(与 API 原值同单位,渲染时再 /100)。 */
  readonly cost: number
  readonly tokens: number
  readonly calls: number
  readonly isOther: boolean
  /** 这片折叠掉了几个模型;非余量片为 0。 */
  readonly mergedCount: number
}

export interface ModelChartData {
  readonly rows: readonly ModelChartRow[]
  /** 全母:参与统计的模型总数(含被折叠进"其他"的那些)。 */
  readonly totalModelCount: number
  /** 全母费用(分),等于 rows 各行 cost 之和 —— 这条恒等式是本票的验收断言。 */
  readonly totalCost: number
  readonly totalTokens: number
}

/**
 * 把"按模型"原始行折成展示行:超过 `limit` 时保留前 `limit` 条 + 一条"其他"余量片。
 *
 * 三条不可漂的写法:
 *  - 余量片是**真累加**剩余各项,不是 `total − head` 的减法 —— 减法会把求和误差
 *    和任何后来的过滤规则都吞进"其他"里,读起来对得上但算不出来源。
 *  - 先过滤 0 值项(cost 与 tokens 皆为 0),它们不贡献任何读数却会占掉展示名额,
 *    把有效模型挤出图表。带 cost 的行永不因 tokens=0 被丢。过滤 0 值不破坏求和恒等式。
 *  - 按 cost 降序取"前 N 大"(V8 的 sort 稳定 ⇒ API 已排序时同值行保持原序)。
 */
export function buildModelChartData(
  source: readonly ByModel[],
  limit: number = MODEL_CHART_ROW_LIMIT,
): ModelChartData {
  const normalized = source
    .map((m) => ({
      model: m.model,
      cost: toFiniteNumber(m.cost),
      tokens: toFiniteNumber(m.tokens),
      calls: toFiniteNumber(m.calls),
    }))
    .filter((m) => m.cost !== 0 || m.tokens !== 0)
    .sort((a, b) => b.cost - a.cost)

  const totalCost = normalized.reduce((sum, m) => sum + m.cost, 0)
  const totalTokens = normalized.reduce((sum, m) => sum + m.tokens, 0)

  if (normalized.length <= limit) {
    return {
      rows: normalized.map((m) => ({ ...m, isOther: false, mergedCount: 0 })),
      totalModelCount: normalized.length,
      totalCost,
      totalTokens,
    }
  }

  const head = normalized.slice(0, limit)
  const tail = normalized.slice(limit)
  const otherRow: ModelChartRow = {
    // 展示文案由渲染处取词表(本函数不碰 i18n),故 model 留空。
    model: '',
    cost: tail.reduce((sum, m) => sum + m.cost, 0),
    tokens: tail.reduce((sum, m) => sum + m.tokens, 0),
    calls: tail.reduce((sum, m) => sum + m.calls, 0),
    isOther: true,
    mergedCount: tail.length,
  }
  return {
    rows: [...head.map((m) => ({ ...m, isOther: false, mergedCount: 0 })), otherRow],
    totalModelCount: normalized.length,
    totalCost,
    totalTokens,
  }
}

export default function AiCostPage() {
  const t = useTranslations('aiCost')
  // "其他"余量片的文案取既有词表 `chat.modelCategoryOther`(五语言齐备)。
  // 刻意不新增 `aiCost.other` —— 新键要走 §19 的五语言流水线改语言包,不在本票文件射程内;
  // 而硬编码中文会撞守门 70 的"新增硬编码中文即拦"。复用现成同义词是唯一无损出路。
  const tChat = useTranslations('chat')
  const locale = useLocale()
  const [days, setDays] = React.useState(7)
  const startDateISO = React.useMemo(
    () => new Date(Date.now() - days * 86400_000).toISOString(),
    [days],
  )
  const endDateISO = React.useMemo(() => new Date().toISOString(), [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'ai-cost', days],
    queryFn: () =>
      api<AiCostDashboard>(
        `/api/admin/ai/cost/dashboard?startDate=${startDateISO}&endDate=${endDateISO}`,
      ).catch(() => EMPTY),
    retry: false,
  })

  const { data: budgets } = useQuery({
    queryKey: ['admin', 'ai-cost', 'budgets'],
    queryFn: () => api<Budget[]>('/api/admin/ai/cost/budgets').catch(() => [] as Budget[]),
    retry: false,
  })

  const d = data ?? EMPTY
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const totalCost = toFiniteNumber(d.summary.totalCost) / 100
  const pc = d.promptCacheMetrics

  // "按模型"图:超限折叠出"其他"余量片,保证呈现行求和 == 全母总额(G-717)。
  const modelChart = React.useMemo(
    () => buildModelChartData(d.byModel, MODEL_CHART_ROW_LIMIT),
    [d.byModel],
  )

  // 计算最大值用于水平条形图。条形基准取**展示行**的最大值(含"其他"片),
  // 这样宽度恒 ≤ 100%:余量片折叠很多模型时,它本就该比单模型更长。
  const maxModelCost = Math.max(...modelChart.rows.map((m) => m.cost), 1)
  const maxDayCost = Math.max(...d.byDay.map((r) => Number(r.cost) || 0), 1)
  const dayFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })

  const cards = [
    {
      key: 'totalCost',
      label: t('totalCost'),
      value: curFmt.format(totalCost),
      icon: Coins,
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'totalTokens',
      label: t('totalTokens'),
      value: fmtNum(d.summary.totalTokens ?? 0),
      icon: Database,
      cls: 'text-primary',
    },
    {
      key: 'totalCalls',
      label: t('totalCalls'),
      value: fmtNum(d.summary.totalCalls ?? 0),
      icon: Zap,
      cls: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'cacheHit',
      label: t('cacheHitRate'),
      value: `${d.summary.cacheHitRate ?? 0}%`,
      icon: TrendingUp,
      cls: 'text-purple-600 dark:text-purple-400',
    },
    ...(pc
      ? [
          {
            key: 'l1Hit',
            label: t('l1HitRate'),
            value: hitRate(pc.hits, pc.misses),
            icon: Layers,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            key: 'l2Hit',
            label: t('l2HitRate'),
            value: hitRate(pc.l2Hits, pc.l2Misses),
            icon: Boxes,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            key: 'pcErrors',
            label: t('promptCacheErrors'),
            value: fmtNum(pc.errors ?? 0),
            icon: AlertCircle,
            cls: (pc.errors ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coins className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/ai-metrics"
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('toMetrics')}</span>
          </Link>
          <select
            aria-label={t('rangeLabel')}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-sm border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value={1}>{t('range1d')}</option>
            <option value={7}>{t('range7d')}</option>
            <option value={30}>{t('range30d')}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <Card key={c.key}>
                  <CardContent className="min-[640px]:p-3 flex items-center gap-3 p-3">
                    <div className={cn('rounded-md bg-muted p-2', c.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 按模型 + 按天 双列 */}
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  {t('byModel')}
                  {/* 总数说明:图被折叠时,人必须看得出"这里只画了 10 条、其实有 N 个"。 */}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {modelChart.totalModelCount}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {modelChart.rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('noModelData')}
                  </p>
                ) : (
                  modelChart.rows.map((row) => (
                    <div key={row.isOther ? OTHER_SLICE_KEY : row.model} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-xs',
                            row.isOther ? 'font-sans text-muted-foreground' : 'font-mono',
                          )}
                        >
                          {row.isOther
                            ? `${tChat('modelCategoryOther')} (+${row.mergedCount})`
                            : row.model}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                          {fmtNum(row.tokens)} tk ·{' '}
                          <span className="text-foreground font-medium">
                            {formatFiniteNumber(curFmt, row.cost / 100)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-xs bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-sm',
                            row.isOther ? 'bg-muted-foreground/40' : 'bg-primary/60',
                          )}
                          style={{ width: `${(row.cost / maxModelCost) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  {t('byDay')}
                  {/* 同"按模型":这里只画最后 10 天,总数必须看得见(30 天档会静默少 20 天)。 */}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {d.byDay.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.byDay.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('noDayData')}</p>
                ) : (
                  d.byDay.slice(-10).map((row) => (
                    <div key={row.date} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">
                          {formatDayLabel(dayFmt, row.date)}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                          {fmtNum(toFiniteNumber(row.calls))} {t('calls')} ·{' '}
                          <span className="text-foreground font-medium">
                            {formatFiniteNumber(curFmt, toFiniteNumber(row.cost) / 100)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-xs bg-muted">
                        <div
                          className="h-full rounded-sm bg-emerald-500/60 dark:bg-emerald-400/60"
                          style={{ width: `${(toFiniteNumber(row.cost) / maxDayCost) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* 预算管理 */}
          {budgets && budgets.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  {t('budgets')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">{t('budgetScope')}</th>
                        <th className="py-2 pr-4 font-medium">{t('budgetKey')}</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t('budgetDailyToken')}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t('budgetMonthlyCost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map((b) => (
                        <tr key={b.id}>
                          <td className="py-2 pr-4">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {b.scope}
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {b.scopeKey}
                            {b.model ? ` (${b.model})` : ''}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtNum(b.dailyTokenLimit)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {curFmt.format(Number(b.monthlyCostLimit) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 用户成本排行 + 预算告警 双列 */}
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <TopUsersSection startDate={startDateISO} endDate={endDateISO} />
            <BudgetAlertsSection />
          </div>

          {/* VIP 档位配额视图 */}
          <VipQuotasSection />
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
