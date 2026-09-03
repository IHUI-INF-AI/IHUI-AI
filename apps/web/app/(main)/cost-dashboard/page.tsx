// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 成本看板(对标 Claude Code / Codex 的成本透明可观测)。
// 消费:
//   GET /api/cost-ledger/summary        → totals + by_tool/by_model + window
//   GET /api/cost-ledger/timeseries     → 按日/小时的 cost + token 走势(?granularity)
// 渲染聚合卡片 + by_tool/by_model 清单 + 纯 CSS 条形走势 + 空态提示。
// 未登录(401)提示"请先登录"。后端:ai-service routers/cost_ledger.py。

'use client'

import * as React from 'react'
import {
  Activity,
  CircleX,
  Coins,
  Cpu,
  Loader2,
  Timer,
  TrendingUp,
  Wrench,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import type { CostSummary, CostTimeseries } from '@/api/cost-ledger-api'

type Granularity = 'day' | 'hour'

export default function CostDashboardPage() {
  const [summary, setSummary] = React.useState<CostSummary | null>(null)
  const [series, setSeries] = React.useState<CostTimeseries>([])
  const [granularity, setGranularity] = React.useState<Granularity>('day')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)

  const load = React.useCallback(async (gran: Granularity) => {
    setLoading(true)
    setError('')
    setNeedLogin(false)
    const sRes = await fetchApi<CostSummary>('/api/cost-ledger/summary')
    const tRes = await fetchApi<CostTimeseries>(`/api/cost-ledger/timeseries?granularity=${gran}`)
    setLoading(false)

    const handleFailure = (res: { success: false; error: string; status?: number }) => {
      if (res.status === 401) {
        setNeedLogin(true)
      } else {
        setError((res as { message?: string }).message || '加载成本数据失败')
      }
      setSummary(null)
      setSeries([])
    }

    if (!sRes.success) return handleFailure(sRes)
    if (!tRes.success) return handleFailure(tRes)
    setSummary(sRes.data)
    setSeries(tRes.data || [])
  }, [])

  React.useEffect(() => {
    void load(granularity)
  }, [load, granularity])

  const fmtUsd = (cost: number) => (cost > 0 ? `$${cost.toFixed(4)}` : '$0')
  const fmtDur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)

  // 条形走势:把桶展开为等宽横柱(cost 与 token 各一个对照柱)
  const maxCost = Math.max(0, ...series.map((b) => b.cost))
  const maxTokens = Math.max(0, ...series.map((b) => b.tokens))
  const pct = (v: number, max: number) => (max > 0 ? Math.max(2, (v / max) * 100) : 0)

  const byToolEntries = summary
    ? Object.entries(summary.by_tool || {}).sort((a, b) => b[1].cost - a[1].cost)
    : []
  const byModelEntries = summary
    ? Object.entries(summary.by_model || {}).sort((a, b) => b[1].cost - a[1].cost)
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">成本看板</h1>
        <div className="ml-auto flex items-center gap-2">
          {(['day', 'hour'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg border px-3 py-1 text-sm transition ${
                granularity === g
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {g === 'day' ? '按日' : '按小时'}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        全链路成本账本聚合:总成本 / Token(入·出)/ 耗时 / 步数,按工具与模型拆分的条 + 时间走势。
      </p>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> 加载中…
        </div>
      )}
      {needLogin && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> 请先登录后查看成本看板(该功能仅对已登录用户开放)
        </p>
      )}
      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {!loading && summary && summary.steps === 0 && !error && !needLogin && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Activity className="h-5 w-5" /> 暂无成本记录,跑几次 Agent 后这里会展示聚合与走势
        </div>
      )}

      {!loading && summary && summary.steps > 0 && (
        <>
          {/* 聚合卡片 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" /> 总成本
              </div>
              <div className="text-xl font-bold">{fmtUsd(summary.total_cost)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                估算 {summary.estimated_count} 条
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> 总 Token
              </div>
              <div className="text-xl font-bold">{summary.total_tokens.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                in {summary.total_tokens_in.toLocaleString()} / out{' '}
                {summary.total_tokens_out.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> 总耗时
              </div>
              <div className="text-xl font-bold">{fmtDur(summary.total_duration_ms)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {summary.window?.start ?? '—'} ~ {summary.window?.end ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> 步数
              </div>
              <div className="text-xl font-bold">{summary.steps}</div>
              <div className="mt-1 text-xs">
                <span className="text-emerald-600">ok {summary.ok_count}</span>
                <span className="text-destructive"> · err {summary.error_count}</span>
              </div>
            </div>
          </div>

          {/* 时间走势 */}
          <div className="mt-4 rounded-xl border p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" /> 成本 / Token 走势(
              {granularity === 'day' ? '按日' : '按小时'})
            </h2>
            {series.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Activity className="h-5 w-5" /> 无时间序列数据
              </div>
            ) : (
              <div className="space-y-1.5">
                {series.map((b) => (
                  <div
                    key={b.bucket}
                    className="grid grid-cols-[7rem_1fr_1fr_5rem] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-muted-foreground" title={b.bucket}>
                      {b.bucket}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 rounded bg-primary/70"
                        style={{ width: `${pct(b.cost, maxCost)}%` }}
                      />
                      <span className="shrink-0 text-muted-foreground">{fmtUsd(b.cost)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 rounded bg-emerald-500/70"
                        style={{ width: `${pct(b.tokens, maxTokens)}%` }}
                      />
                      <span className="shrink-0 text-muted-foreground">
                        {b.tokens.toLocaleString()} tok
                      </span>
                    </div>
                    <span className="text-right text-muted-foreground">{b.steps} 步</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* by_tool / by_model */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4" /> 按工具
              </h2>
              {byToolEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">-</div>
              ) : (
                <ul className="space-y-2">
                  {byToolEntries.map(([name, v]) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <span className="w-40 truncate" title={name}>
                        {name}
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {fmtUsd(v.cost)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                        {v.tokens.toLocaleString()} tok
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Cpu className="h-4 w-4" /> 按模型
              </h2>
              {byModelEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">-</div>
              ) : (
                <ul className="space-y-2">
                  {byModelEntries.map(([name, v]) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <span className="w-40 truncate" title={name}>
                        {name}
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {fmtUsd(v.cost)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                        {v.tokens.toLocaleString()} tok
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠
