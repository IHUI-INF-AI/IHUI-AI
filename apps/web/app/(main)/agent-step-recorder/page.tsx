// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Agent Step 录制回放(Record & Replay,对标 WorkBuddy/Codex 可复现审计)。
// 输入 run_id → 并行拉取:
//   GET /api/agent-recorder/runs/{run_id}/steps   步骤序列(时间序分页)
//   GET /api/agent-recorder/runs/{run_id}/replay  全量回放
//   GET /api/agent-recorder/runs/{run_id}/metrics 聚合指标(步数/成败/token/耗时/成本)
// 渲染运行元信息 + 按时间序的工具调用时间线,单步可展开详情。
// 后端:ai-service routers/step_recorder.py(录制数据带登录鉴权,未登录返回 401)。

'use client'

import * as React from 'react'
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Coins,
  Cpu,
  Loader2,
  Search,
  Timer,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import type {
  RunMetricsResult,
  RunReplayResult,
  RunStep,
  RunStepsResult,
} from '@/api/agent-recorder-api'

const PAGE_SIZE = 50
const TYPE_LABEL: Record<RunStep['type'], string> = {
  tool: '工具调用',
  message: '消息',
  plan: '计划',
}

export default function AgentStepRecorderPage() {
  const [runId, setRunId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)

  const [metrics, setMetrics] = React.useState<RunMetricsResult | null>(null)
  const [steps, setSteps] = React.useState<RunStepsResult | null>(null)
  const [replay, setReplay] = React.useState<RunReplayResult | null>(null)
  const [expanded, setExpanded] = React.useState<number | null>(null)
  const [page, setPage] = React.useState(1)

  const loadRun = React.useCallback(async (rid: string, targetPage = 1) => {
    if (!rid.trim()) return
    setLoading(true)
    setError('')
    setNeedLogin(false)
    const id = rid.trim()

    const mRes = await fetchApi<RunMetricsResult>(`/api/agent-recorder/runs/${encodeURIComponent(id)}/metrics`)
    const sRes = await fetchApi<RunStepsResult>(
      `/api/agent-recorder/runs/${encodeURIComponent(id)}/steps?page=${targetPage}&page_size=${PAGE_SIZE}`,
    )
    const rpRes = await fetchApi<RunReplayResult>(`/api/agent-recorder/runs/${encodeURIComponent(id)}/replay`)
    setLoading(false)

    const handleFailure = (res: { success: false; error: string; status?: number }) => {
      if (res.status === 401) {
        setNeedLogin(true)
        setError('')
      } else {
        setError((res as { message?: string }).message || '加载运行记录失败')
      }
      setMetrics(null)
      setSteps(null)
      setReplay(null)
    }

    if (!mRes.success) return handleFailure(mRes)
    if (!sRes.success) return handleFailure(sRes)
    if (!rpRes.success) return handleFailure(rpRes)
    setMetrics(mRes.data)
    setSteps(sRes.data)
    setReplay(rpRes.data)
    setPage(targetPage)
    setExpanded(null)
  }, [])

  // 时间线数据:优先 steps 分页列表;分页为空但全量回放有数据时以回放弥补
  const timeline: RunStep[] =
    steps && steps.list.length > 0
      ? steps.list
      : steps && steps.total === 0 && replay && replay.steps.length > 0
        ? replay.steps.slice(0, PAGE_SIZE)
        : []

  const fmtDuration = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
  const fmtCost = (cost: number) =>
    cost > 0 ? `$${cost.toFixed(6)}` : '-'

  const totalPages = steps ? Math.max(1, Math.ceil(steps.total / PAGE_SIZE)) : 1

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Agent Step 录制回放</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        输入 run_id,回放一次 Agent 运行的逐步工具调用,含 token/耗时/成本与成败统计。
      </p>

      <div className="mb-6 flex items-center gap-2">
        <input
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void loadRun(runId, 1)}
          placeholder="输入 run_id,例如 0f8a…"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => void loadRun(runId, 1)}
          disabled={loading || !runId.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          加载
        </button>
      </div>

      {needLogin && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> 请先登录后查看运行录制(该功能仅对已登录用户开放)
        </p>
      )}
      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {!loading && !metrics && !error && !needLogin && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Activity className="h-5 w-5" /> 输入 run_id 开始加载录制数据
        </div>
      )}

      {metrics && (
        <>
          {/* 运行元信息 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> 步骤数
              </div>
              <div className="text-xl font-bold">{metrics.step_count}</div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> ok {metrics.ok_count}
                </span>
                <span className="inline-flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" /> error {metrics.error_count}
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> 总 Token
              </div>
              <div className="text-xl font-bold">{metrics.total_tokens}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                in {metrics.total_tokens_in} / out {metrics.total_tokens_out}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> 总耗时
              </div>
              <div className="text-xl font-bold">{fmtDuration(metrics.total_duration_ms)}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" /> 总成本
              </div>
              <div className="text-xl font-bold">{fmtCost(metrics.total_cost)}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> run_id:
            <code className="rounded bg-muted px-1">{metrics.run_id}</code>
            <span className="ml-auto">{steps ? `${steps.total} 条步骤` : ''}</span>
          </div>

          {/* step 时间线 */}
          <div className="mt-4 rounded-xl border p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" /> 步骤时间线({timeline.length})
            </h2>
            {timeline.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Activity className="h-5 w-5" /> 该运行暂无录制步骤
              </div>
            ) : (
              <ul className="space-y-2">
                {timeline.map((step) => (
                  <li key={step.step_index}>
                    <button
                      onClick={() => setExpanded((p) => (p === step.step_index ? null : step.step_index))}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        step.status === 'error'
                          ? 'border-destructive/40 hover:bg-destructive/5'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          #{step.step_index}
                        </span>
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {TYPE_LABEL[step.type] || step.type}
                        </span>
                        {step.tool_name && (
                          <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                            {step.tool_name}
                          </code>
                        )}
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium ${
                            step.status === 'error' ? 'text-destructive' : 'text-emerald-600'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              step.status === 'error'
                                ? 'bg-destructive'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {step.status === 'error' ? 'error' : 'ok'}
                        </span>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Timer className="h-3 w-3" /> {fmtDuration(step.duration_ms)}
                          </span>
                          {step.tokens > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="h-3 w-3" /> {step.tokens}
                            </span>
                          )}
                          {step.cost > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Coins className="h-3 w-3" /> {fmtCost(step.cost)}
                            </span>
                          )}
                          {expanded === step.step_index ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                      {step.result_summary && (
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {step.result_summary}
                        </p>
                      )}
                      {step.at && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">{step.at}</p>
                      )}
                    </button>

                    {expanded === step.step_index && (
                      <div className="mt-1 space-y-2 rounded-lg border-x border-b bg-muted/20 p-3">
                        {step.input_summary && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">入参摘要</p>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{step.input_summary}</pre>
                          </div>
                        )}
                        {step.result_summary && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">结果摘要</p>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{step.result_summary}</pre>
                          </div>
                        )}
                        {step.http_summary && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">HTTP 摘要</p>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{step.http_summary}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {steps && steps.total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                <button
                  onClick={() => void loadRun(runId, Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border px-3 py-1 transition hover:bg-muted disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-muted-foreground">
                  第 {page} / {totalPages} 页 · 共 {steps.total} 步
                </span>
                <button
                  onClick={() => void loadRun(runId, Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border px-3 py-1 transition hover:bg-muted disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
