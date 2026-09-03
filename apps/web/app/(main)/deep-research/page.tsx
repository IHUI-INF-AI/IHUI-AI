// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深度研究(Deep Research)最小可用页面。
// 流程:输入查询 → POST /api/research/start 获取 research_id → 轮询 GET /api/research/{id}
// 实时展示规划/检索/深挖/成稿各阶段进度 → 生成最终 Markdown 报告。
// 注意:后端路由由 master 以 include_router(prefix="/api", tags=["research"]) 挂载。

'use client'

import * as React from 'react'
import { Loader2, Play, FileText, RefreshCw, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'

// 阶段中文标签(与后端 phase 对应)
const PHASE_LABEL: Record<string, string> = {
  planning: '规划问题',
  retrieving: '多源检索',
  deepening: '深度调查(追问)',
  synthesizing: '综合成稿',
  done: '完成',
  error: '出错',
}
const PHASES = ['planning', 'retrieving', 'deepening', 'synthesizing', 'done', 'error'] as const

interface Stage {
  phase: string
  status: string
  detail: string
  started_at?: number
  completed_at?: number
}

interface ResearchState {
  research_id?: string
  query?: string
  status?: string
  running?: boolean
  finished?: boolean
  markdown?: string
  subquestions?: string[]
  gap_questions?: string[]
  iteration?: number
  max_iterations?: number
  evidence?: { question: string; content: string; depth: number; sources: string[] }[]
  stages?: Stage[]
  sources?: { url: string; title: string }[]
  error?: string
}

export default function DeepResearchPage() {
  const [query, setQuery] = React.useState('')
  const [iterations, setIterations] = React.useState(4)
  const [loading, setLoading] = React.useState(false)
  const [state, setState] = React.useState<ResearchState | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // 轮询研究状态
  const poll = React.useCallback(async (id: string) => {
    const res = await fetchApi<ResearchState>(`/api/research/${id}`)
    if (res.success && res.data) {
      setState(res.data)
      if (res.data.finished || res.data.status === 'error') {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [])

  const start = async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setState(null)
    const res = await fetchApi<{ research_id: string; status: string }>('/api/research/start', {
      method: 'POST',
      body: JSON.stringify({ query: q, max_iterations: iterations }),
    })
    if (!res.success || !res.data) {
      setState({ status: 'error', error: (res as { message?: string }).message || '启动失败' })
      setLoading(false)
      return
    }
    setLoading(false)
    // 立即拉一次,随后轮询
    await poll(res.data.research_id)
    timerRef.current = setInterval(() => poll(res.data!.research_id), 2500)
  }

  React.useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  const statusText =
    state?.status === 'error'
      ? '出错'
      : state?.running
        ? '研究中…'
        : state?.finished
          ? '已完成'
          : '待开始'
  const currentPhase = React.useMemo(() => {
    if (!state?.stages?.length) return null
    for (const p of PHASES) {
      if (state.stages.some((s) => s.phase === p && s.status === 'running')) return p
    }
    return state.stages[state.stages.length - 1]?.phase ?? null
  }, [state])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">深度研究 Deep Research</h1>
      </div>

      {/* 输入区 */}
      <div className="mb-6 rounded-xl border p-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="输入研究课题,例如:2026 年大模型 Agent 编排框架的主流方案对比与趋势"
          className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            深挖轮数(最大)
            <input
              type="number"
              min={1}
              max={10}
              value={iterations}
              onChange={(e) =>
                setIterations(Math.max(1, Math.min(10, Number(e.target.value) || 4)))
              }
              className="w-20 rounded-lg border bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={start}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            启动深度研究
          </button>
        </div>
      </div>

      {/* 状态 / 阶段进度 */}
      {state && (
        <div className="mb-6 rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Research ID:{' '}
              <code className="rounded bg-muted px-1">
                {(state.research_id || '').slice(0, 18)}
              </code>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <span
                className={
                  state.status === 'error'
                    ? 'h-2 w-2 rounded-full bg-destructive'
                    : state.running
                      ? 'h-2 w-2 animate-pulse rounded-full bg-primary'
                      : 'h-2 w-2 rounded-full bg-emerald-500'
                }
              />
              {statusText}
            </span>
          </div>
          {currentPhase && (
            <div className="mb-3 text-sm">
              当前阶段:
              <span className="font-medium">{PHASE_LABEL[currentPhase] || currentPhase}</span>
              {typeof state.iteration === 'number' && state.iteration > 0 && (
                <span className="ml-3 text-muted-foreground">
                  深挖第 {state.iteration}/{state.max_iterations} 轮
                </span>
              )}
            </div>
          )}
          {/* 阶段条 */}
          <ol className="flex flex-wrap gap-2 text-xs">
            {PHASES.slice(0, 5).map((p) => {
              const active = state.stages?.some((s) => s.phase === p && s.status === 'running')
              const done = state.stages?.some((s) => s.phase === p && s.status === 'done')
              return (
                <li
                  key={p}
                  className={`rounded-full border px-3 py-1 ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : done
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {active ? (
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                  ) : done ? (
                    '✓ '
                  ) : (
                    ''
                  )}
                  {PHASE_LABEL[p]}
                </li>
              )
            })}
          </ol>
          {state.error && <p className="mt-3 text-sm text-destructive">{state.error}</p>}
        </div>
      )}

      {/* 子问题清单 */}
      {state?.subquestions && state.subquestions.length > 0 && (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> 规划的研究子问题
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {state.subquestions.map((sq, i) => (
              <li key={i}>{sq}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 已检索证据 */}
      {state?.evidence && state.evidence.length > 0 && (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">已收集证据({state.evidence.length})</h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {state.evidence.slice(0, 20).map((e, i) => (
              <li key={i}>
                <span className="font-semibold text-foreground">[{e.question}]</span>
                <span className="ml-1">
                  深度{e.depth} · {e.content.slice(0, 80)}…
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 最终报告 */}
      {state?.markdown ? (
        <div className="rounded-xl border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">研究报告</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              共 {state.sources?.length ?? 0} 个来源
            </span>
          </div>
          <div className="px-5 py-4">
            <MarkdownViewer content={state.markdown} />
          </div>
        </div>
      ) : state?.running ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> 正在生成报告…
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
